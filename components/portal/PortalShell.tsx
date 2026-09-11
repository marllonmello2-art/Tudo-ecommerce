import { getPortalDb } from "../../lib/portal/db";
import { listCategories } from "../../lib/portal/queries";
import { formatToday } from "../../lib/portal/format";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader, type NavItem } from "./SiteHeader";

/**
 * Moldura do site público: barra de editorias (vinda do banco, nunca
 * hardcoded), conteúdo e rodapé. Usada por todas as páginas públicas.
 */
export async function PortalShell({ children }: { children: React.ReactNode }) {
  const db = await getPortalDb();
  const categories: NavItem[] = db
    ? (await listCategories(db)).map((category) => ({ name: category.name, slug: category.slug }))
    : [];

  return (
    <div className="dm">
      <SiteHeader categories={categories} today={formatToday()} />
      <main className="dm-main">{children}</main>
      <SiteFooter categories={categories} />
    </div>
  );
}

/** Aviso exibido quando o binding D1 ainda não está disponível. */
export function DatabaseMissing() {
  return (
    <div className="dm-wrap">
      <div className="dm-page-head">
        <span className="dm-kicker">Configuração pendente</span>
        <h1 className="dm-page-title">Banco de dados não conectado</h1>
        <p className="dm-page-sub">
          Conecte o binding D1 (<code>DB</code>) — e o R2 (<code>BUCKET</code>) para as imagens — no
          ambiente do site. As tabelas e o conteúdo inicial são criados sozinhos na primeira visita.
        </p>
      </div>
    </div>
  );
}
