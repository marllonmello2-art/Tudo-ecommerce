import { sql } from "drizzle-orm";
import { real, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
