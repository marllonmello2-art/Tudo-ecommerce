import Link from "next/link";
import { ArticleCard } from "../components/portal/ArticleCard";
import { Img, ImgPlaceholder } from "../components/portal/Img";
import { Newsletter } from "../components/portal/Newsletter";
import { DatabaseMissing, PortalShell } from "../components/portal/PortalShell";
import { BRAND } from "../lib/portal/brand";
import { getPortalDb } from "../lib/portal/db";
import { formatDateTime } from "../lib/portal/format";
import { getFeatured, homeSections, listCategories, listPublished } from "../lib/portal/queries";

export const dynamic = "force-dynamic";

/** Capa do portal: destaque, últimas notícias e blocos por editoria. */
export default async function HomePage() {
  const db = await getPortalDb();
  if (!db) {
    return (
      <PortalShell>
        <DatabaseMissing />
      </PortalShell>
    );
  }

  const featured = await getFeatured(db);
  const latest = await listPublished(db, { limit: 9, excludeId: featured?.id });
  const categories = await listCategories(db);
  const sections = await homeSections(db, categories, 4);

  return (
    <PortalShell>
      <div className="dm-wrap">
        {featured ? (
          <section className="dm-hero">
            <Link href={`/noticia/${featured.slug}`} className="dm-hero-figure">
              {featured.coverImageUrl ? (
                <Img src={featured.coverImageUrl} alt={featured.title} loading="eager" />
              ) : (
                <ImgPlaceholder label={BRAND.initials} />
              )}
            </Link>
            <div className="dm-hero-body">
              {featured.categoryName ? (
                <Link href={`/editoria/${featured.categorySlug}`}>
                  <span className="dm-kicker dm-kicker-block">{featured.categoryName}</span>
                </Link>
              ) : null}
              <h1 className="dm-hero-title">
                <Link href={`/noticia/${featured.slug}`}>{featured.title}</Link>
              </h1>
              {featured.subtitle ? <p className="dm-hero-deck">{featured.subtitle}</p> : null}
              <div className="dm-meta">
                {featured.authorName ? <strong>{featured.authorName}</strong> : null}
                <span className={featured.authorName ? "dm-dot" : undefined}>
                  {formatDateTime(featured.publishedAt)}
                </span>
              </div>
            </div>
          </section>
        ) : (
          <section className="dm-empty">
            Nenhuma matéria publicada ainda. Entre em <Link href="/admin">/admin</Link> para
            publicar a primeira.
          </section>
        )}

        {latest.length ? (
          <section className="dm-section">
            <div className="dm-section-head">
              <h2 className="dm-section-title">
                Últimas <span>notícias</span>
              </h2>
            </div>
            <div className="dm-grid dm-grid-3">
              {latest.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          </section>
        ) : null}

        {sections.map(({ category, articles }) => (
          <section className="dm-section" key={category.id}>
            <div className="dm-section-head">
              <h2 className="dm-section-title" style={{ borderColor: category.color }}>
                {category.name}
              </h2>
              <Link className="dm-section-more" href={`/editoria/${category.slug}`}>
                Ver tudo →
              </Link>
            </div>
            {/* Com três ou mais matérias a primeira vira manchete da seção. */}
            <div className={`dm-grid ${articles.length >= 3 ? "dm-grid-lead" : "dm-grid-3"}`}>
              {articles.map((article, index) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  variant={index === 0 && articles.length >= 3 ? "lead" : "default"}
                  showDeck={index === 0}
                />
              ))}
            </div>
          </section>
        ))}

        <Newsletter />
      </div>
    </PortalShell>
  );
}
