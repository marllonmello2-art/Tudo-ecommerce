/**
 * Acesso ao banco do portal (Cloudflare D1 + Drizzle).
 *
 * O binding `DB` só existe dentro do Worker, por isso o import de
 * `cloudflare:workers` é dinâmico: em qualquer outro contexto devolvemos
 * `null` e a página mostra o estado "sem banco configurado" em vez de quebrar.
 */
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../../db/schema";
import { BRAND } from "./brand";
import { slugify } from "./slug";

export type PortalDb = ReturnType<typeof drizzle<typeof schema>>;

async function bindings(): Promise<{ DB?: D1Database; BUCKET?: R2Bucket }> {
  try {
    const runtime = (await import("cloudflare:workers")) as {
      env: { DB?: D1Database; BUCKET?: R2Bucket };
    };
    return runtime.env ?? {};
  } catch {
    return {};
  }
}

export async function getD1(): Promise<D1Database | null> {
  return (await bindings()).DB ?? null;
}

export async function getBucket(): Promise<R2Bucket | null> {
  return (await bindings()).BUCKET ?? null;
}

/**
 * Devolve o Drizzle já com o schema do portal e com as tabelas garantidas.
 * `null` quando o binding D1 não está disponível.
 */
export async function getPortalDb(): Promise<PortalDb | null> {
  const d1 = await getD1();
  if (!d1) return null;
  await ensurePortalSchema(d1);
  return drizzle(d1, { schema });
}

/* ------------------------------------------------------------------ *
 * Bootstrap de schema
 *
 * As migrations em `drizzle/` são a fonte oficial do schema, mas o ambiente de
 * hospedagem pode entregar um D1 vazio sem rodar `wrangler d1 migrations
 * apply`. Para o portal nunca subir quebrado, criamos as tabelas com
 * `IF NOT EXISTS` na primeira consulta do processo (custo pago uma única vez).
 * ------------------------------------------------------------------ */

const DDL = [
  `CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#c8102e',
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS authors (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    bio TEXT,
    avatar_url TEXT,
    email TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    subtitle TEXT,
    content TEXT NOT NULL,
    cover_image_url TEXT,
    cover_credit TEXT,
    category_id TEXT,
    author_id TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    featured INTEGER NOT NULL DEFAULT 0,
    published_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    views_count INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE
  )`,
  `CREATE TABLE IF NOT EXISTS article_tags (
    article_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    PRIMARY KEY (article_id, tag_id)
  )`,
  `CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'editor',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL DEFAULT 'site',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS portal_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS articles_status_idx ON articles(status, published_at)`,
  `CREATE INDEX IF NOT EXISTS articles_category_idx ON articles(category_id, published_at)`,
];

/** Editorias iniciais pedidas na pauta do portal. */
const SEED_CATEGORIES: { name: string; color: string }[] = [
  { name: "Política", color: "#c8102e" },
  { name: "Economia", color: "#0b6e4f" },
  { name: "Esportes", color: "#1b5fc1" },
  { name: "Cultura", color: "#8b3fbf" },
  { name: "Internacional", color: "#0f7c8c" },
  { name: "Tecnologia", color: "#2b2f77" },
  { name: "Opinião", color: "#b5651d" },
];

let bootstrapPromise: Promise<void> | null = null;

export function ensurePortalSchema(d1: D1Database): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await d1.batch(DDL.map((statement) => d1.prepare(statement)));
      await seed(d1);
    })().catch((error) => {
      // Uma falha não pode congelar o bootstrap para sempre: zera o cache
      // para a próxima requisição tentar de novo.
      bootstrapPromise = null;
      throw error;
    });
  }
  return bootstrapPromise;
}

/** Seed idempotente: editorias, redação padrão e matérias de demonstração. */
async function seed(d1: D1Database) {
  const categoryCount = await d1
    .prepare("SELECT COUNT(*) AS total FROM categories")
    .first<{ total: number }>();

  if (!categoryCount?.total) {
    await d1.batch(
      SEED_CATEGORIES.map((category, index) =>
        d1
          .prepare(
            "INSERT OR IGNORE INTO categories (id, name, slug, color, position) VALUES (?, ?, ?, ?, ?)",
          )
          .bind(crypto.randomUUID(), category.name, slugify(category.name), category.color, index),
      ),
    );
  }

  const authorCount = await d1
    .prepare("SELECT COUNT(*) AS total FROM authors")
    .first<{ total: number }>();

  if (!authorCount?.total) {
    await d1
      .prepare(
        "INSERT OR IGNORE INTO authors (id, name, slug, bio, email) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(
        crypto.randomUUID(),
        BRAND.defaultAuthorName,
        slugify(BRAND.defaultAuthorName),
        `Equipe de reportagem do ${BRAND.name}.`,
        BRAND.email,
      )
      .run();
  }

  const articleCount = await d1
    .prepare("SELECT COUNT(*) AS total FROM articles")
    .first<{ total: number }>();

  if (!articleCount?.total) await seedDemoArticles(d1);
}

/**
 * Conteúdo de demonstração — são textos sobre o próprio portal, marcados como
 * exemplo, para a home não nascer vazia. Apague pelo painel quando publicar
 * as primeiras matérias de verdade.
 */
async function seedDemoArticles(d1: D1Database) {
  const author = await d1.prepare("SELECT id FROM authors LIMIT 1").first<{ id: string }>();
  const categoryRows = await d1
    .prepare("SELECT id, slug FROM categories")
    .all<{ id: string; slug: string }>();
  const bySlug = new Map(
    (categoryRows.results ?? []).map((row: { id: string; slug: string }) => [row.slug, row.id]),
  );
  const now = new Date();

  const demos = [
    {
      slug: "diario-mello-entra-no-ar",
      title: `${BRAND.name} entra no ar`,
      subtitle: `O portal da família ${BRAND.founderSurname} chega para cobrir o dia a dia com apuração própria e linguagem direta.`,
      category: "politica",
      featured: 1,
      content: `> Esta é uma **matéria de exemplo** criada junto com o portal. Edite ou apague pelo painel em /admin.\n\nO ${BRAND.name} nasce com uma proposta simples: informar sem rodeios. A redação cobre ${SEED_CATEGORIES.map((c) => c.name).join(", ")} e mantém o leitor no centro de cada decisão editorial.\n\n## O que você encontra aqui\n\n- Destaque diário na primeira página\n- Editorias organizadas no menu principal\n- Newsletter com o resumo do dia\n\nBoa leitura.`,
    },
    {
      slug: "como-publicar-sua-primeira-materia",
      title: "Como publicar sua primeira matéria",
      subtitle: "Um passo a passo do painel administrativo, do rascunho à publicação.",
      category: "tecnologia",
      featured: 0,
      content: `> **Matéria de exemplo.** Serve como manual rápido do painel.\n\n1. Acesse \`/admin\` e faça login.\n2. Clique em **Nova matéria**.\n3. Preencha título, linha fina, editoria e autor.\n4. Envie a imagem de capa — ela vai para o bucket R2.\n5. Escreva o texto em Markdown e clique em **Publicar**.\n\nPara publicar de forma automatizada, use a rota \`POST /api/publish\` com o cabeçalho \`x-agent-api-key\`.`,
    },
    {
      slug: "a-newsletter-do-diario-mello",
      title: `A newsletter do ${BRAND.name}`,
      subtitle: "Cadastre seu e-mail e receba o resumo das principais notícias.",
      category: "cultura",
      featured: 0,
      content: `> **Matéria de exemplo.**\n\nO formulário no rodapé guarda os e-mails na tabela \`newsletter_subscribers\`. O disparo do boletim pode ser ligado depois, sem mexer no site.`,
    },
  ];

  await d1.batch(
    demos.map((demo, index) =>
      d1
        .prepare(
          `INSERT OR IGNORE INTO articles
            (id, title, slug, subtitle, content, category_id, author_id, status, featured, published_at, created_at, updated_at, views_count)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, 0)`,
        )
        .bind(
          crypto.randomUUID(),
          demo.title,
          demo.slug,
          demo.subtitle,
          demo.content,
          bySlug.get(demo.category) ?? null,
          author?.id ?? null,
          demo.featured,
          new Date(now.getTime() - index * 3600_000).toISOString(),
          now.toISOString(),
          now.toISOString(),
        ),
    ),
  );
}
