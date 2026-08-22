import { getRuntimeImages } from "../../../db/runtime";

function isSafeRemoteUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const payload = await request.json() as { url?: string };
  const sourceUrl = typeof payload.url === "string" ? payload.url : "";
  if (!sourceUrl || !isSafeRemoteUrl(sourceUrl)) return Response.json({ code: "IMAGE_URL_INVALID", error: "URL de imagem inválida." }, { status: 400 });
  const images = await getRuntimeImages();
  if (!images) return Response.json({ code: "IMAGE_CONVERSION_NOT_CONFIGURED", error: "A conversão para PNG ainda não está habilitada neste ambiente." }, { status: 503 });

  let source: Response;
  try {
    source = await fetch(sourceUrl, { signal: AbortSignal.timeout(15000) });
  } catch {
    return Response.json({ code: "IMAGE_FETCH_ERROR", error: "Não foi possível buscar a imagem original." }, { status: 502 });
  }
  if (!source.ok || !source.body) return Response.json({ code: "IMAGE_FETCH_ERROR", error: "A fonte da imagem não respondeu corretamente." }, { status: 502 });
  try {
    const transformed = await images.input(source.body).transform({}).output({ format: "png", quality: 92 });
    const response = transformed.response();
    return new Response(response.body, { status: response.status, headers: { "content-type": "image/png", "cache-control": "no-store" } });
  } catch {
    return Response.json({ code: "IMAGE_CONVERSION_ERROR", error: "Não foi possível converter a imagem para PNG neste momento." }, { status: 502 });
  }
}
