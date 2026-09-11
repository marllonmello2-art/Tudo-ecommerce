/**
 * Autenticação do painel administrativo.
 *
 * Decisões de segurança (leia antes de mexer):
 * - Senha nunca é guardada em texto: usamos PBKDF2-SHA256 com 150 mil
 *   iterações e salt aleatório por usuário (Web Crypto, disponível no Worker).
 * - A sessão é um token assinado com HMAC-SHA256 — não há estado no servidor.
 *   O segredo vem da variável de ambiente `ADMIN_SESSION_SECRET`; se ela não
 *   existir, geramos um segredo aleatório e guardamos em `portal_settings`.
 *   Em nenhum caso há segredo escrito no código.
 * - O cookie é HttpOnly + SameSite=Lax + Secure, então não é legível por JS.
 */
import { eq } from "drizzle-orm";
import { adminUsers } from "../../db/schema";
import { getD1, getPortalDb, type PortalDb } from "./db";

export const SESSION_COOKIE = "dm_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 horas
const PBKDF2_ITERATIONS = 150_000;

export type AdminSession = {
  sub: string;
  email: string;
  role: string;
  name: string | null;
  exp: number;
};

/* ----------------------------- utilidades ----------------------------- */

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/** Comparação em tempo constante, para não vazar o segredo por timing. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a[index] ^ b[index];
  return diff === 0;
}

/** Lê uma variável de ambiente/secret do Worker (nunca valor hardcoded). */
export async function getEnvSecret(name: string): Promise<string | null> {
  try {
    const runtime = (await import("cloudflare:workers")) as {
      env: Record<string, string | undefined>;
    };
    const value = runtime.env?.[name];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  } catch {
    const value = typeof process !== "undefined" ? process.env?.[name] : undefined;
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }
}

/* ------------------------------- senhas ------------------------------- */

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256,
  );
}

/** Formato guardado no banco: `pbkdf2$<iterações>$<salt>$<hash>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(derived)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < 1000) return false;
  const derived = await pbkdf2(password, fromBase64Url(parts[2]), iterations);
  return timingSafeEqual(new Uint8Array(derived), fromBase64Url(parts[3]));
}

/* ------------------------------ sessões ------------------------------- */

let cachedSecret: string | null = null;

async function sessionSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret;

  const fromEnv = await getEnvSecret("ADMIN_SESSION_SECRET");
  if (fromEnv) {
    cachedSecret = fromEnv;
    return cachedSecret;
  }

  // Sem variável configurada: geramos um segredo aleatório uma única vez e
  // guardamos no banco, para as sessões sobreviverem a novos deploys.
  const d1 = await getD1();
  if (!d1) throw new Error("Sem D1 e sem ADMIN_SESSION_SECRET: sessão indisponível.");

  const existing = await d1
    .prepare("SELECT value FROM portal_settings WHERE key = 'session_secret' LIMIT 1")
    .first<{ value: string }>();
  if (existing?.value) {
    cachedSecret = existing.value;
    return existing.value;
  }

  const generated = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  await d1
    .prepare("INSERT OR IGNORE INTO portal_settings (key, value) VALUES ('session_secret', ?)")
    .bind(generated)
    .run();
  const stored = await d1
    .prepare("SELECT value FROM portal_settings WHERE key = 'session_secret' LIMIT 1")
    .first<{ value: string }>();
  const secret = stored?.value ?? generated;
  cachedSecret = secret;
  return secret;
}

async function hmac(payload: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(await sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return new Uint8Array(signature);
}

export async function createSessionToken(
  user: { id: string; email: string; role: string; name: string | null },
): Promise<string> {
  const session: AdminSession = {
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(session)));
  return `${payload}.${toBase64Url(await hmac(payload))}`;
}

export async function readSessionToken(token: string | undefined): Promise<AdminSession | null> {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  try {
    if (!timingSafeEqual(await hmac(payload), fromBase64Url(signature))) return null;
    const session = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as AdminSession;
    if (!session?.sub || session.exp * 1000 < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function sessionCookie(token: string): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ].join("; ");
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function cookieFromHeader(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}

/** Sessão a partir de uma requisição (rotas de API). */
export async function sessionFromRequest(request: Request): Promise<AdminSession | null> {
  return readSessionToken(cookieFromHeader(request.headers.get("cookie"), SESSION_COOKIE));
}

/** Resposta padrão para chamadas sem sessão válida. */
export function unauthorized() {
  return Response.json(
    { code: "AUTH_REQUIRED", error: "Faça login no painel para continuar." },
    { status: 401 },
  );
}

/* --------------------------- usuários admin --------------------------- */

export async function countAdmins(db: PortalDb): Promise<number> {
  const rows = await db.select({ id: adminUsers.id }).from(adminUsers).limit(1);
  return rows.length;
}

export async function findAdminByEmail(db: PortalDb, email: string) {
  const [row] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, email.toLowerCase().trim()))
    .limit(1);
  return row ?? null;
}

export async function createAdmin(
  db: PortalDb,
  input: { email: string; password: string; name?: string | null; role?: string },
) {
  const user = {
    id: crypto.randomUUID(),
    email: input.email.toLowerCase().trim(),
    name: input.name?.trim() || null,
    passwordHash: await hashPassword(input.password),
    role: input.role === "editor" ? "editor" : "admin",
  };
  await db.insert(adminUsers).values(user);
  return user;
}

/**
 * Primeiro acesso: enquanto não existir nenhum usuário, o painel mostra o
 * formulário de criação em vez do login. Assim não precisamos de senha padrão
 * escrita no código ou no seed.
 */
export async function needsBootstrapAdmin(): Promise<boolean> {
  const db = await getPortalDb();
  if (!db) return false;
  return (await countAdmins(db)) === 0;
}
