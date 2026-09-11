import { deleteArticle, updateArticle } from "../../../../../lib/portal/articles";
import { sessionFromRequest, unauthorized } from "../../../../../lib/portal/auth";
import { getPortalDb } from "../../../../../lib/portal/db";
import { getArticleById, tagsOfArticle } from "../../../../../lib/portal/queries";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  if (!(await sessionFromRequest(request))) return unauthorized();
  const db = await getPortalDb();
  if (!db) return Response.json({ error: "Banco não conectado." }, { status: 503 });

  const { id } = await params;
  const article = await getArticleById(db, id);
  if (!article) return Response.json({ error: "Matéria não encontrada." }, { status: 404 });

  return Response.json({ article, tags: await tagsOfArticle(db, id) });
}

/** PATCH: salva alterações. Campos ausentes ficam como estão. */
export async function PATCH(request: Request, { params }: Context) {
  if (!(await sessionFromRequest(request))) return unauthorized();
  const db = await getPortalDb();
  if (!db) return Response.json({ error: "Banco não conectado." }, { status: 503 });

  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;

  const article = await updateArticle(db, id, {
    title: body.title === undefined ? undefined : String(body.title),
    content: body.content === undefined ? undefined : String(body.content),
    subtitle: body.subtitle === undefined ? undefined : (body.subtitle as string | null),
    categoryId: body.categoryId === undefined ? undefined : (body.categoryId as string | null),
    authorId: body.authorId === undefined ? undefined : (body.authorId as string | null),
    coverImageUrl: body.coverImageUrl === undefined ? undefined : (body.coverImageUrl as string | null),
    coverCredit: body.coverCredit === undefined ? undefined : (body.coverCredit as string | null),
    tags: Array.isArray(body.tags) ? (body.tags as string[]) : undefined,
    status: body.status === undefined ? undefined : String(body.status),
    publishedAt: body.publishedAt === undefined ? undefined : (body.publishedAt as string | null),
    featured: body.featured === undefined ? undefined : Boolean(body.featured),
  });

  if (!article) return Response.json({ error: "Matéria não encontrada." }, { status: 404 });
  return Response.json({ ok: true, article });
}

export async function DELETE(request: Request, { params }: Context) {
  if (!(await sessionFromRequest(request))) return unauthorized();
  const db = await getPortalDb();
  if (!db) return Response.json({ error: "Banco não conectado." }, { status: 503 });

  const { id } = await params;
  await deleteArticle(db, id);
  return Response.json({ ok: true });
}
