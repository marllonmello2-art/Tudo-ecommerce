import Link from "next/link";
import type { Metadata } from "next";
import { AdminShell } from "../../components/admin/AdminShell";
import { ArticleRowActions } from "../../components/admin/ArticleRowActions";
import { getPortalDb } from "../../lib/portal/db";
import { formatShort } from "../../lib/portal/format";
import { adminListArticles, listCategories } from "../../lib/portal/queries";
import { requireAdmin } from "../../lib/portal/session-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Painel", robots: { index: false } };

const STATUS_LABEL: Record<string, string> = {
  published: "Publicada",
  draft: "Rascunho",
  scheduled: "Agendada",
};

/** Dashboard: lista de matérias com filtros por editoria e status. */
export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; editoria?: string; q?: string }>;
}) {
  const session = await requireAdmin();
  const filters = await searchParams;
  const db = await getPortalDb();

  if (!db) {
    return (
      <AdminShell user={session}>
        <div className="dm-panel">
          <h2>Banco não conectado</h2>
          <p>Conecte o binding D1 (<code>DB</code>) para usar o painel.</p>
        </div>
      </AdminShell>
    );
  }

  const [articles, categories] = await Promise.all([
    adminListArticles(db, {
      status: filters.status || undefined,
      categoryId: filters.editoria || undefined,
      search: filters.q || undefined,
    }),
    listCategories(db),
  ]);

  const published = articles.filter((article) => article.status === "published").length;
  const drafts = articles.filter((article) => article.status === "draft").length;
  const views = articles.reduce((total, article) => total + (article.viewsCount ?? 0), 0);

  return (
    <AdminShell user={session}>
      <div className="dm-admin-head">
        <h1>Matérias</h1>
        <Link href="/admin/materias/nova" className="dm-btn">
          + Nova matéria
        </Link>
      </div>

      <div className="dm-stat-row">
        <div className="dm-stat">
          <strong>{articles.length}</strong>
          <span>No filtro atual</span>
        </div>
        <div className="dm-stat">
          <strong>{published}</strong>
          <span>Publicadas</span>
        </div>
        <div className="dm-stat">
          <strong>{drafts}</strong>
          <span>Rascunhos</span>
        </div>
        <div className="dm-stat">
          <strong>{views.toLocaleString("pt-BR")}</strong>
          <span>Visualizações</span>
        </div>
      </div>

      <div className="dm-panel">
        {/* Filtros via GET: recarregam a página sem precisar de JavaScript. */}
        <form className="dm-toolbar" method="get">
          <input type="search" name="q" placeholder="Buscar no título ou no texto" defaultValue={filters.q ?? ""} />
          <select name="status" defaultValue={filters.status ?? ""}>
            <option value="">Todos os status</option>
            <option value="published">Publicadas</option>
            <option value="draft">Rascunhos</option>
            <option value="scheduled">Agendadas</option>
          </select>
          <select name="editoria" defaultValue={filters.editoria ?? ""}>
            <option value="">Todas as editorias</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <button type="submit" className="dm-btn dm-btn-ghost">
            Filtrar
          </button>
        </form>

        <table className="dm-table">
          <thead>
            <tr>
              <th>Título</th>
              <th>Editoria</th>
              <th>Autor</th>
              <th>Status</th>
              <th>Atualizada</th>
              <th>Views</th>
              <th aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {articles.map((article) => (
              <tr key={article.id}>
                <td>
                  <Link href={`/admin/materias/${article.id}`}>{article.title}</Link>
                  {article.featured ? (
                    <span className="dm-badge dm-badge-scheduled" style={{ marginLeft: 8 }}>
                      Destaque
                    </span>
                  ) : null}
                </td>
                <td>{article.categoryName ?? "—"}</td>
                <td>{article.authorName ?? "—"}</td>
                <td>
                  <span className={`dm-badge dm-badge-${article.status}`}>
                    {STATUS_LABEL[article.status] ?? article.status}
                  </span>
                </td>
                <td>{formatShort(article.updatedAt)}</td>
                <td>{article.viewsCount}</td>
                <td>
                  <ArticleRowActions id={article.id} status={article.status} />
                </td>
              </tr>
            ))}
            {articles.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ color: "#6b7280", padding: "26px 10px" }}>
                  Nenhuma matéria encontrada com esses filtros.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
