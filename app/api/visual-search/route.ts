import { getChatGPTUser } from "../../chatgpt-auth";

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 5;
const requestBuckets = new Map<string, { count: number; resetAt: number }>();

function detectImageType(bytes: Uint8Array) {
  const png = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return png || jpeg;
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  const identity = user?.email ?? request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "anonymous";
  const now = Date.now();
  const existing = requestBuckets.get(identity);
  if (!existing || now >= existing.resetAt) requestBuckets.set(identity, { count: 1, resetAt: now + RATE_WINDOW_MS });
  else if (existing.count >= RATE_LIMIT) return Response.json({ code: "VISUAL_SEARCH_RATE_LIMIT", error: "Limite de buscas reversas atingido. Aguarde alguns minutos antes de tentar novamente." }, { status: 429 });
  else existing.count += 1;

  const input = await request.formData();
  const image = input.get("image");
  if (!(image instanceof File)) return Response.json({ error: "Imagem não recebida." }, { status: 400 });
  if (image.size > 10 * 1024 * 1024) return Response.json({ code: "IMAGE_TOO_LARGE", error: "A imagem excede o limite de 10 MB." }, { status: 413 });
  if (!detectImageType(new Uint8Array(await image.slice(0, 16).arrayBuffer()))) return Response.json({ code: "IMAGE_TYPE_INVALID", error: "A busca reversa aceita somente JPG/JPEG ou PNG válidos." }, { status: 415 });
  const body = new FormData();
  body.append("encoded_image", image, image.name || "produto.png");
  body.append("image_content", "");
  let response: Response;
  try {
    response = await fetch("https://images.google.com/searchbyimage/upload", { method: "POST", body, redirect: "manual", signal: AbortSignal.timeout(15000) });
  } catch {
    return Response.json({ code: "VISUAL_SEARCH_UNAVAILABLE", error: "A busca reversa está indisponível no momento. Tente novamente mais tarde." }, { status: 502 });
  }
  const location = response.headers.get("location");
  if (!location) return Response.json({ code: "VISUAL_SEARCH_UNAVAILABLE", error: "A busca reversa não retornou uma página de resultados." }, { status: 502 });
  let results: { imageUrl: string; sourceUrl: string }[] = [];
  try {
    const htmlResponse = await fetch(location, { signal: AbortSignal.timeout(15000) });
    if (!htmlResponse.ok) return Response.json({ code: "VISUAL_SEARCH_UNAVAILABLE", error: "A página de resultados da busca reversa não pôde ser lida." }, { status: 502 });
    const html = await htmlResponse.text();
    const urls = Array.from(new Set((html.match(/https?:\/\/[^"'\s<>]+/g) ?? []).map((url) => url.replaceAll("\\u003d", "=").replaceAll("\\u0026", "&")).filter((url) => /\.(jpg|jpeg|png|webp)(\?|$)/i.test(url))));
    results = urls.slice(0, 8).map((imageUrl) => ({ imageUrl, sourceUrl: location }));
  } catch {
    return Response.json({ code: "VISUAL_SEARCH_UNAVAILABLE", error: "A busca reversa está indisponível no momento porque a página de resultados não pôde ser extraída." }, { status: 502 });
  }
  if (results.length === 0) return Response.json({ code: "VISUAL_SEARCH_NO_RESULTS", error: "A busca reversa não encontrou imagens extraíveis para esta foto. Verifique os resultados diretamente no Google Lens." }, { status: 404 });
  return Response.json({ url: location, results, warning: "Resultados visuais são referências encontradas na web; confirme o produto e a autorização de uso antes de publicar." });
}
