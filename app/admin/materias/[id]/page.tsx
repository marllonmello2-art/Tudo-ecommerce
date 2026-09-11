import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AdminShell } from "../../../../components/admin/AdminShell";
import { ArticleEditor } from "../../../../components/admin/ArticleEditor";
import { getPortalDb } from "../../../../lib/portal/db";
import { getArticleById, listAuthors, listCategories, tagsOfArticle } from "../../../../lib/portal/queries";
import { requireAdmin } from "../../../../lib/portal/session-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Editar matéria", robots: { index: false } };

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAdmin(`/admin/materias/${id}`);
  const db = await getPortalDb();

  if (!db) {
    return (
      <AdminShell user={session}>
        <div className="dm-panel">Banco não conectado.</div>
      </AdminShell>
    );
  }

  const article = await getArticleById(db, id);
  if (!article) notFound();

  const [categories, authors, tags] = await Promise.all([
    listCategories(db),
    listAuthors(db),
    tagsOfArticle(db, id),
  ]);

  return (
    <AdminShell user={session}>
      <ArticleEditor
        categories={categories.map((category) => ({ id: category.id, name: category.name }))}
        authors={authors.map((author) => ({ id: author.id, name: author.name }))}
        article={{
          id: article.id,
          title: article.title,
          slug: article.slug,
          subtitle: article.subtitle,
          content: article.content,
          coverImageUrl: article.coverImageUrl,
          coverCredit: article.coverCredit,
          categoryId: article.categoryId,
          authorId: article.authorId,
          status: article.status,
          featured: article.featured,
          publishedAt: article.publishedAt,
        }}
        initialTags={tags.map((tag) => tag.name)}
      />
    </AdminShell>
  );
}
