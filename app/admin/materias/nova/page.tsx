import type { Metadata } from "next";
import { AdminShell } from "../../../../components/admin/AdminShell";
import { ArticleEditor } from "../../../../components/admin/ArticleEditor";
import { getPortalDb } from "../../../../lib/portal/db";
import { listAuthors, listCategories } from "../../../../lib/portal/queries";
import { requireAdmin } from "../../../../lib/portal/session-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Nova matéria", robots: { index: false } };

export default async function NewArticlePage() {
  const session = await requireAdmin("/admin/materias/nova");
  const db = await getPortalDb();

  if (!db) {
    return (
      <AdminShell user={session}>
        <div className="dm-panel">Banco não conectado.</div>
      </AdminShell>
    );
  }

  const [categories, authors] = await Promise.all([listCategories(db), listAuthors(db)]);

  return (
    <AdminShell user={session}>
      <ArticleEditor
        categories={categories.map((category) => ({ id: category.id, name: category.name }))}
        authors={authors.map((author) => ({ id: author.id, name: author.name }))}
      />
    </AdminShell>
  );
}
