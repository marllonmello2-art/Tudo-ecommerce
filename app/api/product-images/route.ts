type SerpApiImage = {
  original?: string;
  link?: string;
  thumbnail?: string;
  title?: string;
  source?: string;
};

type ProductImageResult = {
  imageUrl: string;
  sourceUrl: string;
  title: string;
  position: number;
};

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const productName = params.get("productName")?.trim().slice(0, 180) ?? "";
  const productEAN = params.get("productEAN")?.trim().slice(0, 64) ?? "";

  if (!productName) return Response.json({ error: "Informe o nome do produto para buscar imagens." }, { status: 400 });

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    console.error("[product-images] SERPAPI_KEY is not configured", { stage: "configuration" });
    return Response.json({ code: "SEARCH_NOT_CONFIGURED", error: "Busca web ainda não configurada. Adicione a variável de ambiente SERPAPI_KEY para conectar ao Google Images via SerpApi." }, { status: 503 });
  }

  const query = [productName, productEAN].filter(Boolean).join(" ").replace(/\s+/g, " ").slice(0, 240);
  const searchParams = new URLSearchParams({ engine: "google_images", q: query, api_key: apiKey, hl: "pt-br", gl: "br", safe: "active", ijn: "0" });

  let response: Response;
  try {
    response = await fetch(`https://serpapi.com/search.json?${searchParams.toString()}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(12000) });
  } catch (error) {
    console.error("[product-images] SerpApi request failed", { stage: "provider-network", name: error instanceof Error ? error.name : "UnknownError", message: error instanceof Error ? error.message : String(error) });
    return Response.json({ code: "SEARCH_NETWORK_ERROR", error: "Não foi possível conectar ao provedor de busca de imagens." }, { status: 502 });
  }

  if (!response.ok) {
    console.error("[product-images] SerpApi returned an error", { stage: "provider-response", status: response.status });
    if (response.status === 401 || response.status === 403) return Response.json({ code: "SEARCH_AUTH_ERROR", error: "A credencial da busca de imagens foi recusada. Revise SERPAPI_KEY." }, { status: 502 });
    if (response.status === 429) return Response.json({ code: "SEARCH_QUOTA", error: "A cota da busca de imagens foi atingida. Tente novamente mais tarde ou revise o plano da SerpApi." }, { status: 429 });
    return Response.json({ code: "SEARCH_PROVIDER_ERROR", error: `O provedor de busca de imagens respondeu com status ${response.status}.` }, { status: 502 });
  }

  let data: { images_results?: SerpApiImage[] };
  try {
    data = await response.json() as { images_results?: SerpApiImage[] };
  } catch (error) {
    console.error("[product-images] SerpApi returned invalid JSON", { stage: "provider-json", name: error instanceof Error ? error.name : "UnknownError", message: error instanceof Error ? error.message : String(error) });
    return Response.json({ code: "SEARCH_INVALID_RESPONSE", error: "O provedor de busca retornou uma resposta inválida." }, { status: 502 });
  }

  const seen = new Set<string>();
  const images: ProductImageResult[] = (data.images_results ?? []).map((item, index) => ({
    imageUrl: item.original ?? item.link ?? "",
    sourceUrl: item.link ?? item.original ?? "",
    title: item.title?.trim() || query,
    position: index + 1,
  })).filter((item) => {
    if (!isHttpUrl(item.imageUrl) || seen.has(item.imageUrl)) return false;
    seen.add(item.imageUrl);
    return true;
  }).slice(0, 4);

  if (images.length === 0) {
    console.warn("[product-images] SerpApi returned no usable image URLs", { stage: "provider-empty", query });
    return Response.json({ code: "SEARCH_NO_RESULTS", error: "A busca web não encontrou imagens para esse produto. Confira o nome e o EAN informado." }, { status: 404 });
  }

  return Response.json({ query, images, source: "SerpApi · Google Images", fetchedAt: new Date().toISOString() });
}
