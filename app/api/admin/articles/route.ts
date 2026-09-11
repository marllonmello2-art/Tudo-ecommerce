import { createArticle } from "../../../../lib/portal/articles";
import { sessionFromRequest, unauthorized } from "../../../../lib/portal/auth";
import { getPortalDb } from "../../../../lib/portal/db";
import { adminListArticles } from "../../../../lib/portal/queries";

export const dynamic = "force-dynamic";

/** GET: lista de matérias do painel, com filtros por status/editoria/busca. */
export async function GET(request: Request) {
  if (!(await sessionFromRequest(request))) return unauthorized();

  const db = await getPortalDb();
  if (!db) return Response.json({ error: "Banco não conectado." }, { status: 503 });

  const params = new URL(request.url).searchParams;
  const articles = await adminListArticles(db, {
    status: params.get("status") ?? undefined,
    categoryId: params.get("category") ?? undefined,
    search: params.get("q") ?? undefined,
  });
  return Response.json({ articles });
}

/** POST: cria matéria (rascunho, publicada ou agendada). */
export async function POST(request: Request) {
  if (!(await sessionFromRequest(request))) return unauthorized();

  const db = await getPortalDb();
  if (!db) return Response.json({ error: "Banco não conectado." }, { status: 503 });

  const body = (await request.json()) as Record<string, unknown>;
  const title = String(body.title ?? "").trim();
  const content = String(body.content ?? "").trim();
  if (!title || !content) {
    return Response.json({ error: "Título e texto são obrigatórios." }, { status: 400 });
  }

  const article = await createArticle(db, {
    title,
    content,
    subtitle: (body.subtitle as string) ?? null,
    categoryId: (body.categoryId as string) ?? null,
    authorId: (body.authorId as string) ?? null,
    coverImageUrl: (body.coverImageUrl as string) ?? null,
    coverCredit: (body.coverCredit as string) ?? null,
    tags: Array.isArray(body.tags) ? (body.tags as string[]) : [],
    status: (body.status as string) ?? "draft",
    publishedAt: (body.publishedAt as string) ?? null,
    featured: Boolean(body.featured),
  });

  return Response.json({ ok: true, article }, { status: 201 });
}
