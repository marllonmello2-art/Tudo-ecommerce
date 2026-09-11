import { adminUsers } from "../../../../db/schema";
import { eq } from "drizzle-orm";
import {
  clearedSessionCookie,
  createSessionToken,
  findAdminByEmail,
  sessionCookie,
  sessionFromRequest,
  verifyPassword,
} from "../../../../lib/portal/auth";
import { getPortalDb } from "../../../../lib/portal/db";

export const dynamic = "force-dynamic";

/** GET: quem está logado (usado pelo painel para checar a sessão). */
export async function GET(request: Request) {
  const session = await sessionFromRequest(request);
  return Response.json({ session });
}

/** POST: login com e-mail e senha. */
export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = (await request.json()) as { email?: string; password?: string };
  } catch {
    return Response.json({ error: "Envie um JSON válido." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password) {
    return Response.json({ error: "Informe e-mail e senha." }, { status: 400 });
  }

  const db = await getPortalDb();
  if (!db) {
    return Response.json(
      { code: "PERSISTENCE_NOT_CONFIGURED", error: "Banco não conectado." },
      { status: 503 },
    );
  }

  const user = await findAdminByEmail(db, email);
  // Mensagem genérica de propósito: não revelamos se o e-mail existe.
  const invalid = Response.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
  if (!user) return invalid;
  if (!(await verifyPassword(password, user.passwordHash))) return invalid;

  await db
    .update(adminUsers)
    .set({ lastLoginAt: new Date().toISOString() })
    .where(eq(adminUsers.id, user.id));

  const token = await createSessionToken(user);
  return Response.json(
    { ok: true, user: { email: user.email, name: user.name, role: user.role } },
    { headers: { "set-cookie": sessionCookie(token) } },
  );
}

/** DELETE: logout. */
export async function DELETE() {
  return Response.json({ ok: true }, { headers: { "set-cookie": clearedSessionCookie() } });
}
