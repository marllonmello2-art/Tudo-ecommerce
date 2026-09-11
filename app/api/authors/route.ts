import { getPortalDb } from "../../../lib/portal/db";
import { listAuthors } from "../../../lib/portal/queries";

export const dynamic = "force-dynamic";

/** Lista pública dos autores, usada pelo agente antes de publicar. */
export async function GET() {
  const db = await getPortalDb();
  if (!db) {
    return Response.json(
      { code: "PERSISTENCE_NOT_CONFIGURED", error: "Banco não conectado." },
      { status: 503 },
    );
  }

  const authors = await listAuthors(db);
  return Response.json({
    authors: authors.map((author) => ({
      id: author.id,
      name: author.name,
      slug: author.slug,
      bio: author.bio,
      avatar_url: author.avatarUrl,
    })),
  });
}
