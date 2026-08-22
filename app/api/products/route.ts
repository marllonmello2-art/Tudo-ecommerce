import { getChatGPTUser } from "../../chatgpt-auth";
import { ensureRuntimeSchema, getRuntimeBucket, getRuntimeDb, persistencePendingResponse } from "../../../db/runtime";

function logPersistenceFailure(stage: string, error: unknown) {
  const details = error instanceof Error ? { name: error.name, message: error.message } : { value: String(error) };
  console.error("[products] persistence failure", { stage, ...details });
}

function parseJson(value: string | null) {
  if (!value) return null;
  try { return JSON.parse(value) as Record<string, unknown>; } catch { return null; }
}

function actualImageType(bytes: Uint8Array) {
  const png = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  if (png) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  return null;
}

function productResponse(row: Record<string, unknown> | undefined, ad: Record<string, unknown> | undefined) {
  if (!row) return { product: null, ad: null };
  const imageKey = typeof row.image_key === "string" ? row.image_key : null;
  return {
    product: { id: row.id, createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at, identifiedAs: row.identified_as, status: row.status, analysis: parseJson(typeof row.analysis_json === "string" ? row.analysis_json : null), imageUrl: imageKey ? `/api/products/image?key=${encodeURIComponent(imageKey)}` : null },
    ad: ad ? { id: ad.id, productId: ad.product_id, createdAt: ad.created_at, title: ad.title, description: ad.description, bullets: parseJson(typeof ad.bullets_json === "string" ? ad.bullets_json : null), platform: ad.platform, status: ad.status } : null,
  };
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ code: "AUTH_REQUIRED", error: "Faça login para acessar seus produtos." }, { status: 401 });
  const db = await getRuntimeDb();
  if (!db) {
    console.error("[products] D1 binding DB is unavailable", { stage: "read-binding" });
    return persistencePendingResponse();
  }
  try {
    await ensureRuntimeSchema(db);
    const productResult = await db.prepare("SELECT id, created_by, created_at, updated_at, image_key, status, identified_as, analysis_json FROM products WHERE created_by = ? ORDER BY updated_at DESC, created_at DESC LIMIT 1").bind(user.email).all<Record<string, unknown>>();
    const product = productResult.results?.[0];
    if (!product) return Response.json({ product: null, ad: null });
    const adResult = await db.prepare("SELECT id, product_id, created_at, title, description, bullets_json, platform, status FROM ads WHERE product_id = ? AND created_by = ? ORDER BY created_at DESC LIMIT 1").bind(product.id, user.email).all<Record<string, unknown>>();
    return Response.json(productResponse(product, adResult.results?.[0]));
  } catch (error) {
    logPersistenceFailure("read-d1", error);
    return Response.json({ code: "PERSISTENCE_ERROR", error: "Não foi possível carregar o último produto salvo." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ code: "AUTH_REQUIRED", error: "Faça login para salvar o produto." }, { status: 401 });
  const db = await getRuntimeDb();
  if (!db) {
    console.error("[products] D1 binding DB is unavailable", { stage: "write-binding" });
    return persistencePendingResponse();
  }
  const input = await request.formData();
  const analysisValue = input.get("analysis");
  const platformValue = input.get("platform");
  if (typeof analysisValue !== "string" || typeof platformValue !== "string") return Response.json({ code: "PRODUCT_DATA_MISSING", error: "Dados do produto incompletos." }, { status: 400 });
  const analysis = parseJson(analysisValue);
  if (!analysis) return Response.json({ code: "PRODUCT_DATA_INVALID", error: "A análise do produto não está em um formato válido." }, { status: 400 });

  try {
    await ensureRuntimeSchema(db);
    const productId = crypto.randomUUID();
    const adId = crypto.randomUUID();
    const image = input.get("image");
    const bucket = await getRuntimeBucket();
    let imageKey: string | null = null;
    let imageMime: string | null = null;
    let persistedImage = false;
    if (image instanceof File) {
      if (image.size > 10 * 1024 * 1024) {
        console.warn("[products] image rejected by route size validation", { stage: "write-image-size", bytes: image.size });
        return Response.json({ code: "IMAGE_TOO_LARGE", error: "A imagem excede o limite de 10 MB." }, { status: 413 });
      }
      const imageBytes = new Uint8Array(await image.arrayBuffer());
      const detectedMime = actualImageType(imageBytes);
      if (!detectedMime || !['image/jpeg', 'image/png'].includes(image.type) || detectedMime !== image.type) return Response.json({ code: "IMAGE_TYPE_INVALID", error: "A imagem persistida deve ser um JPG/JPEG ou PNG real; a extensão não é suficiente." }, { status: 415 });
      imageMime = detectedMime;
      if (bucket) {
        imageKey = `products/${encodeURIComponent(user.email)}/${productId}`;
        await bucket.put(imageKey, imageBytes, { httpMetadata: { contentType: detectedMime, cacheControl: "private, max-age=3600" } });
        persistedImage = true;
      }
    }
    const title = typeof analysis.title === "string" ? analysis.title : "Produto para venda online";
    const description = typeof analysis.description === "string" ? analysis.description : "";
    const bullets = Array.isArray(analysis.bullets) ? analysis.bullets : [];
    const identifiedAs = typeof analysis.identifiedAs === "string" ? analysis.identifiedAs : "Produto identificado pela imagem";
    await db.batch([
      db.prepare("INSERT INTO products (id, created_by, image_key, image_mime, identified_as, analysis_json, status) VALUES (?, ?, ?, ?, ?, ?, 'analyzed')").bind(productId, user.email, imageKey, imageMime, identifiedAs, JSON.stringify(analysis)),
      db.prepare("INSERT INTO ads (id, product_id, created_by, title, description, bullets_json, platform, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft')").bind(adId, productId, user.email, title, description, JSON.stringify(bullets), platformValue),
    ]);
    return Response.json({ saved: true, persistedImage, productId, adId, imageUrl: imageKey ? `/api/products/image?key=${encodeURIComponent(imageKey)}` : null }, { status: 201 });
  } catch (error) {
    logPersistenceFailure("write-d1-or-r2", error);
    return Response.json({ code: "PERSISTENCE_ERROR", error: "Não foi possível salvar o produto e o anúncio." }, { status: 500 });
  }
}
