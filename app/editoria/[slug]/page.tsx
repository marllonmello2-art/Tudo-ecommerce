import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArticleCard } from "../../../components/portal/ArticleCard";
import { Newsletter } from "../../../components/portal/Newsletter";
import { DatabaseMissing, PortalShell } from "../../../components/portal/PortalShell";
import { BRAND } from "../../../lib/portal/brand";
import { getPortalDb } from "../../../lib/portal/db";
import { countPublished, getCategoryBySlug, listPublished } from "../../../lib/portal/queries";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ pagina?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const db = await getPortalDb();
  const category = db ? await getCategoryBySlug(db, slug) : null;
  if (!category) return { title: "Editoria" };

  return {
    title: category.name,
    description: `Últimas notícias de ${category.name} no ${BRAND.name}.`,
    alternates: { canonical: `/editoria/${category.slug}` },
    openGraph: {
      title: `${category.name} · ${BRAND.name}`,
      description: `Últimas notícias de ${category.name}.`,
      type: "website",
    },
  };
}

/** Lista paginada das matérias de uma editoria, mais recentes primeiro. */
export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { pagina } = await searchParams;
  const db = await getPortalDb();
  if (!db) {
    return (
      <PortalShell>
        <DatabaseMissing />
      </PortalShell>
    );
  }

  const category = await getCategoryBySlug(db, slug);
  if (!category) notFound();

  const page = Math.max(1, Number(pagina) || 1);
  const [articles, total] = await Promise.all([
    listPublished(db, { categoryId: category.id, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    countPublished(db, { categoryId: category.id }),
  ]);
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PortalShell>
      <div className="dm-wrap">
        <header className="dm-page-head" style={{ borderColor: category.color }}>
          <span className="dm-kicker" style={{ color: category.color }}>
            Editoria
          </span>
          <h1 className="dm-page-title">{category.name}</h1>
          <p className="dm-page-sub">
            {total} {total === 1 ? "matéria publicada" : "matérias publicadas"}
          </p>
        </header>

        {articles.length ? (
          <div className="dm-grid dm-grid-3">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <p className="dm-empty">Ainda não há matérias publicadas nesta editoria.</p>
        )}

        {lastPage > 1 ? (
          <nav className="dm-pagination" aria-label="Paginação">
            {page > 1 ? (
              <Link href={`/editoria/${category.slug}?pagina=${page - 1}`}>← Anterior</Link>
            ) : null}
            <span>
              Página {page} de {lastPage}
            </span>
            {page < lastPage ? (
              <Link href={`/editoria/${category.slug}?pagina=${page + 1}`}>Próxima →</Link>
            ) : null}
          </nav>
        ) : null}

        <Newsletter />
      </div>
    </PortalShell>
  );
}
