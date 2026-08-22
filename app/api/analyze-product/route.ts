type VisionAnalysis = {
  identifiedAs: string;
  confidence: string;
  ean?: string;
  title: string;
  description: string;
  bullets: string[];
  technicalSheet: { label: string; value: string }[];
  fiscal: { ncm: string; ncmNote: string; cest: string; cestNote: string };
  price: { minimum: number; average: number; maximum: number; note: string };
  analysisSource: "vision";
  analysisNote: string;
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function logVisionFailure(stage: string, error: unknown, extra: Record<string, unknown> = {}) {
  const details = error instanceof Error ? { name: error.name, message: error.message } : { value: String(error) };
  console.error("[analyze-product] vision failure", { stage, ...extra, ...details });
}

function detectImageType(bytes: Uint8Array): "image/png" | "image/jpeg" | null {
  const png = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  if (png) return "image/png";
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (jpeg) return "image/jpeg";
  return null;
}

function readImageDimensions(bytes: Uint8Array, type: "image/png" | "image/jpeg") {
  if (type === "image/png" && bytes.length >= 24) {
    return { width: new DataView(bytes.buffer, bytes.byteOffset).getUint32(16), height: new DataView(bytes.buffer, bytes.byteOffset).getUint32(20) };
  }
  if (type === "image/jpeg") {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
      if (!length) break;
      const isFrame = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
      if (isFrame && offset + 8 < bytes.length) return { height: (bytes[offset + 5] << 8) + bytes[offset + 6], width: (bytes[offset + 7] << 8) + bytes[offset + 8] };
      offset += 2 + length;
    }
  }
  return null;
}

function text(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function parseModelJson(value: unknown): Record<string, unknown> | null {
  const content = typeof value === "string"
    ? value
    : Array.isArray(value)
      ? value.map((part) => typeof part === "string" ? part : typeof part === "object" && part !== null && "text" in part ? String(part.text ?? "") : "").join("")
      : "";
  if (!content.trim()) return null;
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function normalizeAnalysis(raw: Record<string, unknown>): VisionAnalysis {
  const technicalSheet = Array.isArray(raw.technicalSheet)
    ? raw.technicalSheet.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      return [{ label: text(row.label, "Característica"), value: text(row.value, "A confirmar") }];
    }).slice(0, 12)
    : [];
  const bullets = Array.isArray(raw.bullets)
    ? raw.bullets.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()).slice(0, 8)
    : [];
  const rawPrice = raw.price && typeof raw.price === "object" ? raw.price as Record<string, unknown> : {};
  return {
    identifiedAs: text(raw.identifiedAs, "Produto identificado pela imagem"),
    confidence: text(raw.confidence, "baixa — revise a identificação"),
    ean: typeof raw.ean === "string" && raw.ean.trim() ? raw.ean.trim() : undefined,
    title: text(raw.title, "Produto identificado pela imagem — revise antes de publicar"),
    description: text(raw.description, "Descrição preliminar gerada a partir dos elementos visíveis na imagem. Revise as informações antes de publicar."),
    bullets: bullets.length ? bullets : ["Confirme marca, modelo, medidas e material", "Revise a descrição antes de publicar"],
    technicalSheet: technicalSheet.length ? technicalSheet : [{ label: "Informações visíveis", value: "Revisar na embalagem" }],
    fiscal: {
      ncm: "A confirmar",
      ncmNote: "A análise visual não determina NCM. Confirme a classificação com contador ou fonte fiscal oficial.",
      cest: "A confirmar",
      cestNote: "CEST não deve ser presumido pela aparência do produto. Confirme conforme a operação.",
    },
    price: {
      minimum: number(rawPrice.minimum),
      average: number(rawPrice.average),
      maximum: number(rawPrice.maximum),
      note: "Estimativa preliminar baseada na categoria visual; não é uma consulta de mercado em tempo real.",
    },
    analysisSource: "vision",
    analysisNote: "Análise realizada por modelo multimodal. Confirme dados de produto, fiscais e preço antes de publicar.",
  };
}

export async function POST(request: Request) {
  const input = await request.formData();
  const image = input.get("image");
  const platformValue = input.get("platform");
  const platform = typeof platformValue === "string" ? platformValue : "marketplace";
  if (!(image instanceof File)) return Response.json({ code: "IMAGE_MISSING", error: "Imagem não recebida." }, { status: 400 });
  if (image.size > MAX_IMAGE_BYTES) {
    console.warn("[analyze-product] image rejected by route size validation", { bytes: image.size });
    return Response.json({ code: "IMAGE_TOO_LARGE", error: "A imagem excede o limite de 10 MB." }, { status: 413 });
  }

  const imageBytes = new Uint8Array(await image.arrayBuffer());
  const bytes = imageBytes.slice(0, 16);
  const detectedType = detectImageType(bytes);
  if (!detectedType) return Response.json({ code: "IMAGE_TYPE_INVALID", error: "Use uma imagem JPEG ou PNG válida." }, { status: 415 });
  const dimensions = readImageDimensions(imageBytes, detectedType);
  if (!dimensions || dimensions.width < 500 || dimensions.height < 500) return Response.json({ code: "IMAGE_RESOLUTION_LOW", error: "Use uma imagem com pelo menos 500 × 500 pixels para a análise." }, { status: 422 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[analyze-product] OPENAI_API_KEY is not configured", { stage: "configuration" });
    return Response.json({ code: "VISION_NOT_CONFIGURED", error: "A análise visual real ainda não está configurada. Cadastre OPENAI_API_KEY no ambiente de produção." }, { status: 503 });
  }

  let binary = "";
  for (const byte of imageBytes) binary += String.fromCharCode(byte);
  const imageData = btoa(binary);
  const model = process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";
  const payload = {
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "Você analisa fotos de produtos para comércio eletrônico no Brasil. Responda somente JSON válido. Não invente marca, medidas, EAN, NCM ou CEST. Quando algo não estiver legível, use 'A confirmar'. NCM e CEST devem sempre ser 'A confirmar' porque a classificação fiscal exige validação especializada.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analise a imagem deste produto para a plataforma ${platform}. Identifique o produto pelo conteúdo visual, leia apenas textos realmente visíveis na embalagem e gere o anúncio preliminar. Retorne exatamente este formato JSON: {"identifiedAs":"string","confidence":"alta|média|baixa e motivo","ean":"string ou vazio","title":"string","description":"string","bullets":["string"],"technicalSheet":[{"label":"string","value":"string"}],"fiscal":{"ncm":"A confirmar","ncmNote":"string","cest":"A confirmar","cestNote":"string"},"price":{"minimum":0,"average":0,"maximum":0,"note":"string"}}. A faixa de preço é apenas estimativa preliminar, não consulta atual de mercado.`,
          },
          { type: "image_url", image_url: { url: `data:${detectedType};base64,${imageData}`, detail: "high" } },
        ],
      },
    ],
  };

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    logVisionFailure("provider-network", error, { model });
    return Response.json({ code: "VISION_NETWORK_ERROR", error: "Não foi possível conectar ao provedor de visão." }, { status: 502 });
  }

  if (!response.ok) {
    console.error("[analyze-product] provider returned an error", { stage: "provider-response", status: response.status, model });
    if (response.status === 429) return Response.json({ code: "VISION_QUOTA", error: "O provedor de visão atingiu o limite de uso. Tente novamente mais tarde." }, { status: 429 });
    if (response.status === 401 || response.status === 403) return Response.json({ code: "VISION_AUTH_ERROR", error: "A credencial da análise visual foi recusada. Revise OPENAI_API_KEY." }, { status: 502 });
    return Response.json({ code: "VISION_PROVIDER_ERROR", error: `O provedor de visão respondeu com status ${response.status}.` }, { status: 502 });
  }

  let body: { choices?: { message?: { content?: unknown } }[] };
  try {
    body = await response.json() as { choices?: { message?: { content?: unknown } }[] };
  } catch (error) {
    logVisionFailure("provider-json", error, { model });
    return Response.json({ code: "VISION_INVALID_RESPONSE", error: "O provedor de visão retornou uma resposta inválida." }, { status: 502 });
  }
  const parsed = parseModelJson(body.choices?.[0]?.message?.content);
  if (!parsed) {
    console.error("[analyze-product] provider returned no valid analysis JSON", { stage: "provider-json-shape", model });
    return Response.json({ code: "VISION_INVALID_JSON", error: "A análise visual não retornou o JSON esperado." }, { status: 502 });
  }

  return Response.json({ analysis: normalizeAnalysis(parsed), source: "openai-vision", model, analyzedAt: new Date().toISOString() });
}
