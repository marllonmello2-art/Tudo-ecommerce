import { getBucket } from "../../../lib/portal/db";

export const dynamic = "force-dynamic";

/**
 * Serve as imagens guardadas no R2 (capas de matéria e fotos de autor).
 *
 * SEGURANÇA: só entregamos objetos com o prefixo `portal/`. Isso impede que a
 * rota pública sirva arquivos privados de outras áreas do mesmo bucket.
 */
export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (!key.startsWith("portal/") || key.includes("..")) {
    return Response.json({ error: "Imagem não encontrada." }, { status: 404 });
  }

  const bucket = await getBucket();
  if (!bucket) {
    return Response.json(
      { code: "PERSISTENCE_NOT_CONFIGURED", error: "Bucket R2 não conectado." },
      { status: 503 },
    );
  }

  const object = await bucket.get(key);
  if (!object) return Response.json({ error: "Imagem não encontrada." }, { status: 404 });

  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
      etag: object.httpEtag,
    },
  });
}
