import { countAdmins, createAdmin, createSessionToken, sessionCookie } from "../../../../lib/portal/auth";
import { getPortalDb } from "../../../../lib/portal/db";

export const dynamic = "force-dynamic";

/**
 * Primeiro acesso ao painel.
 *
 * Em vez de nascer com uma senha padrão no código (que vazaria junto com o
 * repositório), o portal deixa o dono criar o primeiro usuário — e a rota se
 * fecha sozinha assim que existe um admin cadastrado.
 */
export async function POST(request: Request) {
  const db = await getPortalDb();
  if (!db) {
    return Response.json(
      { code: "PERSISTENCE_NOT_CONFIGURED", error: "Banco não conectado." },
      { status: 503 },
    );
  }

  if ((await countAdmins(db)) > 0) {
    return Response.json(
      { code: "SETUP_CLOSED", error: "O painel já possui um usuário. Faça login." },
      { status: 409 },
    );
  }

  let body: { email?: string; password?: string; name?: string };
  try {
    body = (await request.json()) as { email?: string; password?: string; name?: string };
  } catch {
    return Response.json({ error: "Envie um JSON válido." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return Response.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }
  if (password.length < 10) {
    return Response.json({ error: "A senha precisa ter pelo menos 10 caracteres." }, { status: 400 });
  }

  const user = await createAdmin(db, { email, password, name: body.name ?? null, role: "admin" });
  const token = await createSessionToken({ ...user, name: user.name });

  return Response.json(
    { ok: true, user: { email: user.email, name: user.name, role: user.role } },
    { status: 201, headers: { "set-cookie": sessionCookie(token) } },
  );
}
