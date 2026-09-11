import type { Metadata } from "next";
import { ArticleCard } from "../../components/portal/ArticleCard";
import { DatabaseMissing, PortalShell } from "../../components/portal/PortalShell";
import { getPortalDb } from "../../lib/portal/db";
import { searchArticles } from "../../lib/portal/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Busca",
  description: "Busque notícias por título e conteúdo.",
  robots: { index: false },
};

/** Resultados da busca por título, linha fina e corpo do texto. */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const term = (q ?? "").trim();
  const db = await getPortalDb();
  if (!db) {
    return (
      <PortalShell>
        <DatabaseMissing />
      </PortalShell>
    );
  }

  const results = term.length >= 2 ? await searchArticles(db, term, { limit: 30 }) : [];

  return (
    <PortalShell>
      <div className="dm-wrap">
        <header className="dm-page-head">
          <span className="dm-kicker">Busca</span>
          <h1 className="dm-page-title">{term ? `Resultados para “${term}”` : "O que você procura?"}</h1>
          {term ? (
            <p className="dm-page-sub">
              {results.length} {results.length === 1 ? "matéria encontrada" : "matérias encontradas"}
            </p>
          ) : (
            <p className="dm-page-sub">Digite pelo menos duas letras no campo de busca do topo.</p>
          )}
        </header>

        {results.length ? (
          <div className="dm-grid dm-grid-3">
            {results.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        ) : term.length >= 2 ? (
          <p className="dm-empty">
            Nenhuma matéria encontrada. Tente outras palavras ou navegue pelas editorias.
          </p>
        ) : null}
      </div>
    </PortalShell>
  );
}
