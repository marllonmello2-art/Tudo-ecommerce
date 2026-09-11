import { categories } from "../../../../db/schema";
import { sessionFromRequest, unauthorized } from "../../../../lib/portal/auth";
import { getPortalDb } from "../../../../lib/portal/db";
import { listCategories } from "../../../../lib/portal/queries";
import { slugify } from "../../../../lib/portal/slug";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await sessionFromRequest(request))) return unauthorized();
  const db = await getPortalDb();
  if (!db) return Response.json({ error: "Banco não conectado." }, { status: 503 });
  return Response.json({ categories: await listCategories(db) });
}

/** Cria uma editoria (nome, slug e cor da tag). */
export async function POST(request: Request) {
  if (!(await sessionFromRequest(request))) return unauthorized();
  const db = await getPortalDb();
  if (!db) return Response.json({ error: "Banco não conectado." }, { status: 503 });

  const body = (await request.json()) as { name?: string; slug?: string; color?: string; position?: number };
  const name = (body.name ?? "").trim();
  if (!name) return Response.json({ error: "Informe o nome da editoria." }, { status: 400 });

  const category = {
    id: crypto.randomUUID(),
    name,
    slug: slugify(body.slug?.trim() || name),
    color: (body.color ?? "#c8102e").trim(),
    position: Number(body.position) || 0,
    createdAt: new Date().toISOString(),
  };

  try {
    await db.insert(categories).values(category);
  } catch {
    return Response.json({ error: "Já existe uma editoria com esse endereço (slug)." }, { status: 409 });
  }
  return Response.json({ ok: true, category }, { status: 201 });
}
