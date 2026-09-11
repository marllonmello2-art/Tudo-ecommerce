/**
 * Regras de criação/edição de matérias, compartilhadas pelo painel
 * administrativo e pela rota automatizada `POST /api/publish`.
 */
import { eq } from "drizzle-orm";
import { articles, authors, categories } from "../../db/schema";
import type { PortalDb } from "./db";
import { getArticleById, syncArticleTags } from "./queries";
import { slugify, uniqueSlug } from "./slug";

export type ArticleStatus = "draft" | "published" | "scheduled";

export type ArticleInput = {
  title: string;
  subtitle?: string | null;
  content: string;
  categoryId?: string | null;
  categorySlug?: string | null;
  authorId?: string | null;
  authorName?: string | null;
  coverImageUrl?: string | null;
  coverCredit?: string | null;
  tags?: string[];
  status?: string | null;
  publishedAt?: string | null;
  featured?: boolean;
};

export function normalizeStatus(value: string | null | undefined): ArticleStatus {
  if (value === "published" || value === "scheduled") return value;
  return "draft";
}

/** Slug único para a matéria, derivado do título. */
async function slugFor(db: PortalDb, title: string, currentId?: string): Promise<string> {
  return uniqueSlug(title, async (candidate) => {
    const [row] = await db
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.slug, candidate))
      .limit(1);
    return Boolean(row) && row.id !== currentId;
  });
}

/** Aceita id ou slug da editoria; devolve o id válido (ou null). */
export async function resolveCategoryId(
  db: PortalDb,
  input: { categoryId?: string | null; categorySlug?: string | null },
): Promise<string | null> {
  if (input.categoryId) {
    const [row] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, input.categoryId))
      .limit(1);
    if (row) return row.id;
  }
  if (input.categorySlug) {
    const [row] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, slugify(input.categorySlug)))
      .limit(1);
    if (row) return row.id;
  }
  return null;
}

/**
 * Aceita id do autor ou nome. Quando vem só o nome e ele ainda não existe,
 * o autor é criado — é o caso do agente de IA publicando pela API.
 */
export async function resolveAuthorId(
  db: PortalDb,
  input: { authorId?: string | null; authorName?: string | null },
): Promise<string | null> {
  if (input.authorId) {
    const [row] = await db
      .select({ id: authors.id })
      .from(authors)
      .where(eq(authors.id, input.authorId))
      .limit(1);
    if (row) return row.id;
  }

  const name = input.authorName?.trim();
  if (!name) return null;

  const slug = slugify(name);
  const [existing] = await db.select({ id: authors.id }).from(authors).where(eq(authors.slug, slug)).limit(1);
  if (existing) return existing.id;

  const created = { id: crypto.randomUUID(), name, slug };
  await db.insert(authors).values(created);
  return created.id;
}

function publishedAtFor(status: ArticleStatus, requested: string | null | undefined): string | null {
  if (status === "draft") return requested ?? null;
  if (requested) {
    const date = new Date(requested);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
}

/** Cria a matéria e devolve o registro completo já com editoria e autor. */
export async function createArticle(db: PortalDb, input: ArticleInput) {
  const status = normalizeStatus(input.status);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await db.insert(articles).values({
    id,
    title: input.title.trim(),
    slug: await slugFor(db, input.title),
    subtitle: input.subtitle?.trim() || null,
    content: input.content,
    coverImageUrl: input.coverImageUrl?.trim() || null,
    coverCredit: input.coverCredit?.trim() || null,
    categoryId: await resolveCategoryId(db, input),
    authorId: await resolveAuthorId(db, input),
    status,
    featured: input.featured ? 1 : 0,
    publishedAt: publishedAtFor(status, input.publishedAt),
    createdAt: now,
    updatedAt: now,
    viewsCount: 0,
  });

  if (input.tags?.length) await syncArticleTags(db, id, input.tags, slugify);
  if (input.featured) await clearOtherFeatured(db, id);

  return getArticleById(db, id);
}

/** Atualiza a matéria; campos ausentes permanecem como estão. */
export async function updateArticle(db: PortalDb, id: string, input: Partial<ArticleInput>) {
  const [current] = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
  if (!current) return null;

  const status = input.status === undefined ? (current.status as ArticleStatus) : normalizeStatus(input.status);
  const titleChanged = Boolean(input.title && input.title.trim() !== current.title);

  await db
    .update(articles)
    .set({
      title: input.title?.trim() ?? current.title,
      slug: titleChanged ? await slugFor(db, input.title as string, id) : current.slug,
      subtitle: input.subtitle === undefined ? current.subtitle : input.subtitle?.trim() || null,
      content: input.content ?? current.content,
      coverImageUrl:
        input.coverImageUrl === undefined ? current.coverImageUrl : input.coverImageUrl?.trim() || null,
      coverCredit: input.coverCredit === undefined ? current.coverCredit : input.coverCredit?.trim() || null,
      categoryId:
        input.categoryId === undefined && input.categorySlug === undefined
          ? current.categoryId
          : await resolveCategoryId(db, input),
      authorId:
        input.authorId === undefined && input.authorName === undefined
          ? current.authorId
          : await resolveAuthorId(db, input),
      status,
      featured: input.featured === undefined ? current.featured : input.featured ? 1 : 0,
      publishedAt:
        input.publishedAt === undefined && status === current.status
          ? current.publishedAt
          : publishedAtFor(status, input.publishedAt ?? current.publishedAt),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(articles.id, id));

  if (input.tags) await syncArticleTags(db, id, input.tags, slugify);
  if (input.featured) await clearOtherFeatured(db, id);

  return getArticleById(db, id);
}

export async function deleteArticle(db: PortalDb, id: string) {
  await syncArticleTags(db, id, [], slugify);
  await db.delete(articles).where(eq(articles.id, id));
}

/** Só uma matéria pode ocupar o destaque principal da capa. */
async function clearOtherFeatured(db: PortalDb, keepId: string) {
  await db.update(articles).set({ featured: 0 }).where(eq(articles.featured, 1));
  await db.update(articles).set({ featured: 1 }).where(eq(articles.id, keepId));
}
