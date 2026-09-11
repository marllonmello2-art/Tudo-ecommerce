import { eq } from "drizzle-orm";
import { articles, categories } from "../../../../../db/schema";
import { sessionFromRequest, unauthorized } from "../../../../../lib/portal/auth";
import { getPortalDb } from "../../../../../lib/portal/db";
import { slugify } from "../../../../../lib/portal/slug";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  if (!(await sessionFromRequest(request))) return unauthorized();
  const db = await getPortalDb();
  if (!db) return Response.json({ error: "Banco não conectado." }, { status: 503 });

  const { id } = await params;
  const body = (await request.json()) as { name?: string; slug?: string; color?: string; position?: number };
  const [current] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  if (!current) return Response.json({ error: "Editoria não encontrada." }, { status: 404 });

  await db
    .update(categories)
    .set({
      name: body.name?.trim() || current.name,
      slug: body.slug ? slugify(body.slug) : current.slug,
      color: body.color?.trim() || current.color,
      position: body.position === undefined ? current.position : Number(body.position) || 0,
    })
    .where(eq(categories.id, id));

  return Response.json({ ok: true });
}

/** Remove a editoria e desvincula as matérias (elas viram "sem editoria"). */
export async function DELETE(request: Request, { params }: Context) {
  if (!(await sessionFromRequest(request))) return unauthorized();
  const db = await getPortalDb();
  if (!db) return Response.json({ error: "Banco não conectado." }, { status: 503 });

  const { id } = await params;
  await db.update(articles).set({ categoryId: null }).where(eq(articles.categoryId, id));
  await db.delete(categories).where(eq(categories.id, id));
  return Response.json({ ok: true });
}
