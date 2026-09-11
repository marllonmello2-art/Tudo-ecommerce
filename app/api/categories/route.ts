import { getPortalDb } from "../../../lib/portal/db";
import { listCategories } from "../../../lib/portal/queries";

export const dynamic = "force-dynamic";

/**
 * Lista pública das editorias — serve o site e também o agente de IA, que
 * precisa saber quais `category_slug` são válidos antes de chamar /api/publish.
 */
export async function GET() {
  const db = await getPortalDb();
  if (!db) {
    return Response.json(
      { code: "PERSISTENCE_NOT_CONFIGURED", error: "Banco não conectado." },
      { status: 503 },
    );
  }

  const categories = await listCategories(db);
  return Response.json({
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      color: category.color,
    })),
  });
}
