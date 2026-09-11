import { sessionFromRequest, unauthorized } from "../../../../lib/portal/auth";
import { getBucket } from "../../../../lib/portal/db";

export const dynamic = "force-dynamic";

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB

/**
 * Detecta o tipo real pelo cabeçalho do arquivo (magic bytes).
 * Confiar no `content-type` enviado pelo navegador permitiria subir um
 * arquivo arbitrário só renomeando a extensão.
 */
function sniff(bytes: Uint8Array): { mime: string; ext: string } | null {
  const startsWith = (...signature: number[]) =>
    signature.every((byte, index) => bytes[index] === byte);

  if (startsWith(0x89, 0x50, 0x4e, 0x47)) return { mime: "image/png", ext: "png" };
  if (startsWith(0xff, 0xd8, 0xff)) return { mime: "image/jpeg", ext: "jpg" };
  if (startsWith(0x47, 0x49, 0x46, 0x38)) return { mime: "image/gif", ext: "gif" };
  // WEBP = "RIFF"????"WEBP"
  if (
    startsWith(0x52, 0x49, 0x46, 0x46) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

/** Upload de imagem (capa de matéria ou foto de autor) para o bucket R2. */
export async function POST(request: Request) {
  if (!(await sessionFromRequest(request))) return unauthorized();

  const bucket = await getBucket();
  if (!bucket) {
    return Response.json(
      {
        code: "PERSISTENCE_NOT_CONFIGURED",
        error: "Bucket R2 (BUCKET) não conectado — conecte-o para enviar imagens.",
      },
      { status: 503 },
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  const kind = String(form.get("kind") ?? "capa");
  if (!(file instanceof File)) {
    return Response.json({ error: "Nenhum arquivo recebido." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "A imagem deve ter no máximo 6 MB." }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniff(bytes);
  if (!type) {
    return Response.json({ error: "Envie uma imagem JPG, PNG, WEBP ou GIF." }, { status: 415 });
  }

  const folder = kind === "autor" ? "autores" : "capas";
  const key = `portal/${folder}/${crypto.randomUUID()}.${type.ext}`;
  await bucket.put(key, bytes, {
    httpMetadata: { contentType: type.mime, cacheControl: "public, max-age=31536000, immutable" },
  });

  return Response.json({ ok: true, key, url: `/api/media?key=${encodeURIComponent(key)}` }, { status: 201 });
}
