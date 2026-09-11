import { sql } from "drizzle-orm";
import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  imageKey: text("image_key"),
  imageMime: text("image_mime"),
  identifiedAs: text("identified_as").notNull(),
  analysisJson: text("analysis_json").notNull(),
  status: text("status").notNull().default("analyzed"),
});

export const ads = sqliteTable("ads", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  bulletsJson: text("bullets_json").notNull(),
  platform: text("platform").notNull(),
  status: text("status").notNull().default("draft"),
});

export const pricingSimulations = sqliteTable("pricing_simulations", {
  id: text("id").primaryKey(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  platform: text("platform").notNull(),
  cost: real("cost").notNull(),
  margin: real("margin").notNull(),
  fee: real("fee").notNull(),
  fixed: real("fixed").notNull(),
  shipping: real("shipping").notNull(),
  recommendedPrice: real("recommended_price").notNull(),
  net: real("net").notNull(),
  profit: real("profit").notNull(),
});

export const profiles = sqliteTable("profiles", {
  email: text("email").primaryKey(),
  displayName: text("display_name").notNull(),
  photoKey: text("photo_key"),
  photoMime: text("photo_mime"),
  photoData: text("photo_data"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const trendSnapshots = sqliteTable("trend_snapshots", {
  id: text("id").primaryKey(),
  marketplace: text("marketplace").notNull(),
  category: text("category").notNull(),
  payload: text("payload").notNull(),
  origin: text("origin").notNull(),
  fetchedAt: text("fetched_at").notNull(),
});

/* ------------------------------------------------------------------ *
 * Portal de notícias Diário Mello
 * ------------------------------------------------------------------ */

/** Editorias (Política, Economia, ...). Criadas/editadas pelo painel. */
export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  /** Cor usada na tag visual da editoria. */
  color: text("color").notNull().default("#c8102e"),
  /** Ordem no menu principal. */
  position: integer("position").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

/** Jornalistas/colunistas que assinam as matérias. */
export const authors = sqliteTable("authors", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  email: text("email"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

/** Matérias. `content` guarda Markdown. */
export const articles = sqliteTable("articles", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  /** Linha fina (deck) exibida abaixo do título. */
  subtitle: text("subtitle"),
  content: text("content").notNull(),
  coverImageUrl: text("cover_image_url"),
  coverCredit: text("cover_credit"),
  categoryId: text("category_id").references(() => categories.id),
  authorId: text("author_id").references(() => authors.id),
  /** draft | published | scheduled */
  status: text("status").notNull().default("draft"),
  /** Destaque principal da home (hero). */
  featured: integer("featured").notNull().default(0),
  publishedAt: text("published_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  viewsCount: integer("views_count").notNull().default(0),
});

export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
});

/** Junção many-to-many entre matérias e tags. */
export const articleTags = sqliteTable(
  "article_tags",
  {
    articleId: text("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
    tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.articleId, table.tagId] })],
);

/** Usuários do painel administrativo. Senha guardada como hash PBKDF2. */
export const adminUsers = sqliteTable("admin_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash").notNull(),
  /** admin | editor */
  role: text("role").notNull().default("editor"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastLoginAt: text("last_login_at"),
});

export const newsletterSubscribers = sqliteTable("newsletter_subscribers", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  source: text("source").notNull().default("site"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

/** Configurações internas (ex.: segredo de assinatura das sessões). */
export const portalSettings = sqliteTable("portal_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
