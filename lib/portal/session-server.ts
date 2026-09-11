/**
 * Leitura da sessão do painel em Server Components.
 * (As rotas de API usam `sessionFromRequest`, do módulo auth.)
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, readSessionToken, type AdminSession } from "./auth";

export async function currentAdmin(): Promise<AdminSession | null> {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
}

/**
 * Proteção das rotas `/admin/*`: sem sessão válida, o usuário é mandado
 * para a tela de login.
 */
export async function requireAdmin(returnTo = "/admin"): Promise<AdminSession> {
  const session = await currentAdmin();
  if (!session) redirect(`/admin/login?return_to=${encodeURIComponent(returnTo)}`);
  return session;
}
