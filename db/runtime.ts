type RuntimeBindings = {
  DB?: D1Database;
  BUCKET?: R2Bucket;
  IMAGES?: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
};

async function getBindings(): Promise<RuntimeBindings> {
  try {
    const runtimeModule = await import("cloudflare:workers") as { env: RuntimeBindings };
    return runtimeModule.env;
  } catch {
    return {};
  }
}

export async function getRuntimeDb() {
  return (await getBindings()).DB;
}

export async function getRuntimeBucket() {
  return (await getBindings()).BUCKET;
}

export async function getRuntimeImages() {
  return (await getBindings()).IMAGES;
}

let schemaPromise: Promise<void> | null = null;

export function ensureRuntimeSchema(db: D1Database) {
  if (!schemaPromise) {
    schemaPromise = db.batch([
      db.prepare("CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, image_key TEXT, image_mime TEXT, identified_as TEXT NOT NULL, analysis_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'analyzed')"),
      db.prepare("CREATE TABLE IF NOT EXISTS ads (id TEXT PRIMARY KEY NOT NULL, product_id TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, title TEXT NOT NULL, description TEXT NOT NULL, bullets_json TEXT NOT NULL, platform TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft')"),
      db.prepare("CREATE TABLE IF NOT EXISTS pricing_simulations (id TEXT PRIMARY KEY NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, platform TEXT NOT NULL, cost REAL NOT NULL, margin REAL NOT NULL, fee REAL NOT NULL, fixed REAL NOT NULL, shipping REAL NOT NULL, recommended_price REAL NOT NULL, net REAL NOT NULL, profit REAL NOT NULL)"),
      db.prepare("CREATE TABLE IF NOT EXISTS profiles (email TEXT PRIMARY KEY NOT NULL, display_name TEXT NOT NULL, photo_key TEXT, photo_mime TEXT, photo_data TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
      db.prepare("CREATE TABLE IF NOT EXISTS trend_snapshots (id TEXT PRIMARY KEY NOT NULL, marketplace TEXT NOT NULL, category TEXT NOT NULL, payload TEXT NOT NULL, origin TEXT NOT NULL, fetched_at TEXT NOT NULL)"),
      db.prepare("CREATE INDEX IF NOT EXISTS products_created_by_idx ON products(created_by, updated_at)"),
      db.prepare("CREATE INDEX IF NOT EXISTS ads_created_by_idx ON ads(created_by, created_at)"),
      db.prepare("CREATE INDEX IF NOT EXISTS pricing_created_by_idx ON pricing_simulations(created_by, created_at)"),
      db.prepare("CREATE INDEX IF NOT EXISTS trend_snapshots_marketplace_idx ON trend_snapshots(marketplace, fetched_at)"),
    ]).then(() => undefined);
  }
  return schemaPromise;
}

export function persistencePendingResponse() {
  return Response.json({ code: "PERSISTENCE_NOT_CONFIGURED", error: "Persistência ainda não configurada. Conecte os bindings D1 (DB) e, para arquivos, R2 (BUCKET) no ambiente do site." }, { status: 503 });
}
