import { getChatGPTUser } from "../../../chatgpt-auth";
import { ensureRuntimeSchema, getRuntimeBucket, getRuntimeDb, persistencePendingResponse } from "../../../../db/runtime";

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ code: "AUTH_REQUIRED", error: "Faça login para acessar esta imagem." }, { status: 401 });
  const key = new URL(request.url).searchParams.get("key") ?? "";
  const db = await getRuntimeDb();
  const bucket = await getRuntimeBucket();
  if (!db || !bucket) return persistencePendingResponse();
  try {
    await ensureRuntimeSchema(db);
    const owner = await db.prepare("SELECT image_mime FROM products WHERE image_key = ? AND created_by = ? LIMIT 1").bind(key, user.email).first<Record<string, unknown>>();
    if (!owner) return Response.json({ error: "Imagem não encontrada." }, { status: 404 });
    const object = await bucket.get(key);
    if (!object) return Response.json({ error: "Arquivo não encontrado." }, { status: 404 });
    return new Response(object.body, { headers: { "content-type": typeof owner.image_mime === "string" ? owner.image_mime : "application/octet-stream", "cache-control": "private, max-age=3600" } });
  } catch {
    return Response.json({ code: "PERSISTENCE_ERROR", error: "Não foi possível carregar a imagem salva." }, { status: 500 });
  }
}
