import { createArticle, normalizeStatus } from "../../../lib/portal/articles";
import { getEnvSecret } from "../../../lib/portal/auth";
import { getPortalDb } from "../../../lib/portal/db";
import { excerpt } from "../../../lib/portal/markdown";

export const dynamic = "force-dynamic";

/**
 * Publicação automatizada de matérias (ex.: um agente de IA que prepara o
 * conteúdo).
 *
 * AUTENTICAÇÃO: cabeçalho `x-agent-api-key`, comparado em tempo constante com
 * o secret `AGENT_API_KEY` do Worker. A chave nunca aparece no código; sem ela
 * configurada, a rota responde 503 em vez de aceitar qualquer chamada.
 */

type PublishBody = {
  title?: string;
  subtitle?: string;
  content?: string;
  category_slug?: string;
  category_id?: string;
  author_id?: string;
  author_name?: string;
  tags?: string[];
  cover_image_url?: string;
  cover_credit?: string;
  status?: string;
  published_at?: string;
  featured?: boolean;
};

/** Comparação em tempo constante entre a chave enviada e o secret. */
function secureEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

async function authorize(request: Request): Promise<Response | null> {
  const configured = (await getEnvSecret("AGENT_API_KEY")) ?? (await getEnvSecret("PORTAL_AGENT_API_KEY"));
  if (!configured) {
    return Response.json(
      {
        code: "AGENT_KEY_NOT_CONFIGURED",
        error:
          "Defina o secret AGENT_API_KEY no ambiente do Worker para habilitar a publicação automatizada.",
      },
      { status: 503 },
    );
  }

  const provided = request.headers.get("x-agent-api-key") ?? "";
  if (!provided || !secureEquals(provided, configured)) {
    return Response.json(
      { code: "INVALID_AGENT_KEY", error: "Chave de agente inválida." },
      { status: 401 },
    );
  }
  return null;
}

export async function POST(request: Request) {
  const denied = await authorize(request);
  if (denied) return denied;

  let body: PublishBody;
  try {
    body = (await request.json()) as PublishBody;
  } catch {
    return Response.json({ code: "INVALID_JSON", error: "Envie um JSON válido." }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  const content = (body.content ?? "").trim();
  const missing: string[] = [];
  if (!title) missing.push("title");
  if (!content) missing.push("content");
  if (missing.length) {
    return Response.json(
      { code: "MISSING_FIELDS", error: `Campos obrigatórios ausentes: ${missing.join(", ")}.` },
      { status: 400 },
    );
  }

  const status = normalizeStatus(body.status);
  const db = await getPortalDb();
  if (!db) {
    return Response.json(
      { code: "PERSISTENCE_NOT_CONFIGURED", error: "Banco D1 não conectado." },
      { status: 503 },
    );
  }

  const article = await createArticle(db, {
    title,
    subtitle: body.subtitle ?? null,
    content,
    categorySlug: body.category_slug ?? null,
    categoryId: body.category_id ?? null,
    authorId: body.author_id ?? null,
    authorName: body.author_name ?? null,
    coverImageUrl: body.cover_image_url ?? null,
    coverCredit: body.cover_credit ?? null,
    tags: Array.isArray(body.tags) ? body.tags.filter((tag) => typeof tag === "string") : [],
    status,
    publishedAt: body.published_at ?? null,
    featured: Boolean(body.featured),
  });

  if (!article) {
    return Response.json(
      { code: "CREATE_FAILED", error: "Não foi possível criar a matéria." },
      { status: 500 },
    );
  }

  const origin = new URL(request.url).origin;
  return Response.json(
    {
      ok: true,
      article: {
        id: article.id,
        title: article.title,
        slug: article.slug,
        subtitle: article.subtitle,
        status: article.status,
        category: article.categoryName,
        category_slug: article.categorySlug,
        author: article.authorName,
        cover_image_url: article.coverImageUrl,
        published_at: article.publishedAt,
        excerpt: excerpt(article.content, 200),
        url: `${origin}/noticia/${article.slug}`,
      },
    },
    { status: 201 },
  );
}
