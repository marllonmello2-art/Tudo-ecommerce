import { desc, eq, lte, or, and } from "drizzle-orm";
import { articles, categories } from "../../db/schema";
import { getPortalDb } from "../../lib/portal/db";

export const dynamic = "force-dynamic";

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Sitemap gerado dinamicamente a partir das matérias e editorias publicadas. */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const db = await getPortalDb();

  const urls: { loc: string; lastmod?: string; priority: string }[] = [
    { loc: `${origin}/`, priority: "1.0" },
    { loc: `${origin}/sobre`, priority: "0.3" },
    { loc: `${origin}/contato`, priority: "0.3" },
    { loc: `${origin}/expediente`, priority: "0.2" },
    { loc: `${origin}/privacidade`, priority: "0.2" },
  ];

  if (db) {
    const now = new Date().toISOString();
    const [categoryRows, articleRows] = await Promise.all([
      db.select().from(categories).orderBy(categories.position),
      db
        .select({
          slug: articles.slug,
          updatedAt: articles.updatedAt,
          publishedAt: articles.publishedAt,
        })
        .from(articles)
        .where(
          or(
            eq(articles.status, "published"),
            and(eq(articles.status, "scheduled"), lte(articles.publishedAt, now)),
          ),
        )
        .orderBy(desc(articles.publishedAt))
        .limit(2000),
    ]);

    for (const category of categoryRows) {
      urls.push({ loc: `${origin}/editoria/${category.slug}`, priority: "0.6" });
    }
    for (const article of articleRows) {
      urls.push({
        loc: `${origin}/noticia/${article.slug}`,
        lastmod: article.updatedAt ?? article.publishedAt ?? undefined,
        priority: "0.8",
      });
    }
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) =>
      `  <url><loc>${xmlEscape(url.loc)}</loc>${
        url.lastmod ? `<lastmod>${xmlEscape(new Date(url.lastmod).toISOString())}</lastmod>` : ""
      }<priority>${url.priority}</priority></url>`,
  )
  .join("\n")}
</urlset>`;

  return new Response(body, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=600" },
  });
}
