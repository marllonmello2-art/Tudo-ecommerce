import Link from "next/link";
import type { ArticleCard as ArticleCardData } from "../../lib/portal/queries";
import { formatDate } from "../../lib/portal/format";
import { BRAND } from "../../lib/portal/brand";
import { Img, ImgPlaceholder } from "./Img";

type Variant = "default" | "lead" | "slim";

/** Card de matéria usado na home, nas editorias e nos relacionados. */
export function ArticleCard({
  article,
  variant = "default",
  showDeck = true,
}: {
  article: ArticleCardData;
  variant?: Variant;
  showDeck?: boolean;
}) {
  const href = `/noticia/${article.slug}`;
  const classes = ["dm-card", variant === "lead" && "dm-card-lead", variant === "slim" && "dm-card-slim"]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={classes}>
      <Link href={href} className="dm-card-figure" aria-label={article.title}>
        {article.coverImageUrl ? (
          <Img src={article.coverImageUrl} alt={article.title} />
        ) : (
          <ImgPlaceholder label={BRAND.initials} />
        )}
      </Link>
      <div className="dm-card-body">
        {article.categoryName ? (
          <Link
            href={`/editoria/${article.categorySlug}`}
            className="dm-kicker"
            style={{ color: article.categoryColor ?? undefined }}
          >
            {article.categoryName}
          </Link>
        ) : null}
        <h3 className="dm-card-title">
          <Link href={href}>{article.title}</Link>
        </h3>
        {showDeck && article.subtitle && variant !== "slim" ? (
          <p className="dm-card-deck">{article.subtitle}</p>
        ) : null}
        <div className="dm-meta">
          {article.authorName ? <span>{article.authorName}</span> : null}
          {article.publishedAt ? (
            <span className={article.authorName ? "dm-dot" : undefined}>
              {formatDate(article.publishedAt)}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
