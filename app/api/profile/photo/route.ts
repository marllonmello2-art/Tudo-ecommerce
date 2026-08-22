import { getChatGPTUser } from "../../../chatgpt-auth";
import { ensureRuntimeSchema, getRuntimeBucket, getRuntimeDb, persistencePendingResponse } from "../../../../db/runtime";

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ code: "AUTH_REQUIRED", error: "Faça login para acessar esta foto." }, { status: 401 });
  const key = new URL(request.url).searchParams.get("key") ?? "";
  const db = await getRuntimeDb();
  const bucket = await getRuntimeBucket();
  if (!db || !bucket) return persistencePendingResponse();
  try {
    await ensureRuntimeSchema(db);
    const row = await db.prepare("SELECT photo_mime FROM profiles WHERE email = ? AND photo_key = ? LIMIT 1").bind(user.email, key).first<Record<string, unknown>>();
    if (!row) return Response.json({ error: "Foto não encontrada." }, { status: 404 });
    const object = await bucket.get(key);
    if (!object) return Response.json({ error: "Arquivo não encontrado." }, { status: 404 });
    return new Response(object.body, { headers: { "content-type": typeof row.photo_mime === "string" ? row.photo_mime : "application/octet-stream", "cache-control": "private, max-age=3600" } });
  } catch {
    return Response.json({ code: "PERSISTENCE_ERROR", error: "Não foi possível carregar a foto salva." }, { status: 500 });
  }
}
