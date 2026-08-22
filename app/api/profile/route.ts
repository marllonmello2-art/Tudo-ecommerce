import { getChatGPTUser } from "../../chatgpt-auth";
import { ensureRuntimeSchema, getRuntimeBucket, getRuntimeDb, persistencePendingResponse } from "../../../db/runtime";

const MAX_PROFILE_BYTES = 2 * 1024 * 1024;

function imageType(bytes: Uint8Array) {
  const png = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  if (png) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  return null;
}

function dataUrl(bytes: Uint8Array, mime: string) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:${mime};base64,${btoa(binary)}`;
}

function publicProfile(row: Record<string, unknown> | undefined) {
  if (!row) return { profile: null };
  const key = typeof row.photo_key === "string" ? row.photo_key : null;
  const photoData = typeof row.photo_data === "string" ? row.photo_data : null;
  return { profile: { email: row.email, displayName: row.display_name, photoUrl: photoData ?? (key ? `/api/profile/photo?key=${encodeURIComponent(key)}` : null), persistent: Boolean(photoData || key) } };
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ code: "AUTH_REQUIRED", error: "Faça login para acessar o perfil." }, { status: 401 });
  const db = await getRuntimeDb();
  if (!db) return persistencePendingResponse();
  try {
    await ensureRuntimeSchema(db);
    const row = await db.prepare("SELECT email, display_name, photo_key, photo_data FROM profiles WHERE email = ? LIMIT 1").bind(user.email).first<Record<string, unknown>>();
    return Response.json(publicProfile(row));
  } catch {
    return Response.json({ code: "PERSISTENCE_ERROR", error: "Não foi possível carregar o perfil salvo." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ code: "AUTH_REQUIRED", error: "Faça login para salvar a foto de perfil." }, { status: 401 });
  const db = await getRuntimeDb();
  if (!db) return persistencePendingResponse();
  const input = await request.formData();
  const photo = input.get("photo");
  if (!(photo instanceof File)) return Response.json({ code: "PHOTO_MISSING", error: "Foto não recebida." }, { status: 400 });
  if (photo.size > MAX_PROFILE_BYTES) return Response.json({ code: "PHOTO_TOO_LARGE", error: "A foto de perfil deve ter no máximo 2 MB." }, { status: 413 });
  const bytes = new Uint8Array(await photo.arrayBuffer());
  const mime = imageType(bytes);
  if (!mime) return Response.json({ code: "PHOTO_TYPE_INVALID", error: "Use uma foto JPG/JPEG ou PNG válida." }, { status: 415 });

  try {
    await ensureRuntimeSchema(db);
    const bucket = await getRuntimeBucket();
    let photoKey: string | null = null;
    let photoData: string | null = null;
    if (bucket) {
      photoKey = `profiles/${encodeURIComponent(user.email)}/${crypto.randomUUID()}`;
      await bucket.put(photoKey, bytes, { httpMetadata: { contentType: mime, cacheControl: "private, max-age=3600" } });
    } else if (bytes.byteLength <= 512 * 1024) {
      photoData = dataUrl(bytes, mime);
    } else {
      return Response.json({ code: "R2_NOT_CONFIGURED", error: "Conecte o R2 (BUCKET) para salvar fotos maiores que 512 KB entre dispositivos." }, { status: 503 });
    }
    await db.prepare("INSERT INTO profiles (email, display_name, photo_key, photo_mime, photo_data) VALUES (?, ?, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET display_name = excluded.display_name, photo_key = excluded.photo_key, photo_mime = excluded.photo_mime, photo_data = excluded.photo_data, updated_at = CURRENT_TIMESTAMP").bind(user.email, user.displayName, photoKey, mime, photoData).run();
    return Response.json({ saved: true, persistent: true, photoUrl: photoData ?? (photoKey ? `/api/profile/photo?key=${encodeURIComponent(photoKey)}` : null) });
  } catch {
    return Response.json({ code: "PERSISTENCE_ERROR", error: "Não foi possível salvar a foto de perfil." }, { status: 500 });
  }
}
