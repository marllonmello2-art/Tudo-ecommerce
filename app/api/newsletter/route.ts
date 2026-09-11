import { newsletterSubscribers } from "../../../db/schema";
import { getPortalDb } from "../../../lib/portal/db";

export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Cadastro na newsletter. O disparo do e-mail fica para uma etapa futura. */
export async function POST(request: Request) {
  let payload: { email?: string; source?: string };
  try {
    payload = (await request.json()) as { email?: string; source?: string };
  } catch {
    return Response.json({ error: "Envie um JSON válido." }, { status: 400 });
  }

  const email = (payload.email ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) {
    return Response.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }

  const db = await getPortalDb();
  if (!db) {
    return Response.json(
      { code: "PERSISTENCE_NOT_CONFIGURED", error: "Cadastro indisponível: banco não conectado." },
      { status: 503 },
    );
  }

  // `onConflictDoNothing` deixa o cadastro repetido silencioso — para o leitor
  // o resultado é o mesmo e não vazamos quem já é assinante.
  await db
    .insert(newsletterSubscribers)
    .values({
      id: crypto.randomUUID(),
      email,
      source: (payload.source ?? "site").slice(0, 40),
      createdAt: new Date().toISOString(),
    })
    .onConflictDoNothing();

  return Response.json({ ok: true });
}
