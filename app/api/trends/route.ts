import { marketplaceIdFromName, marketplaceNameFromId, type MarketplaceId } from "../../../lib/marketplaces";
import { ensureRuntimeSchema, getRuntimeDb, persistencePendingResponse } from "../../../db/runtime";

type Platform = "Mercado Livre" | "Shopee" | "SHEIN" | "TikTok Shop";
type TrendOrigin = "google-trends" | "relatorio-publicado";
type TrendDirection = "subindo" | "estável" | "caindo";

type TrendItem = {
  rank: number;
  title: string;
  category: string;
  price: string;
  monthlySales: string;
  growth: string;
  imageUrl: string;
  url: string;
  origin: TrendOrigin;
  sourceLabel: string;
  referenceDate: string;
  interestIndex?: number;
  direction?: TrendDirection;
  reportPosition?: number;
};

type TrendSource = {
  origin: TrendOrigin;
  label: string;
  url: string;
  referenceDate: string;
};

type TrendFeed = {
  platform: Platform;
  mode: "live" | "cache" | "unavailable";
  reason?: "missing-config" | "no-terms" | "provider-error" | "no-data";
  items: TrendItem[];
  checkedAt: string;
  sourceUrl: string;
  sourceLabel: string;
  sources: TrendSource[];
  message: string;
  cachedAt?: string;
};

type ReportSeed = { title: string; category: string; position?: number };
type ReportConfig = {
  url: string;
  label: string;
  referenceDate: string;
  addedOn: string;
  seeds: ReportSeed[];
};
type PlatformConfig = { terms: string[]; reports: ReportConfig[] };
type TrendLookup = { items: TrendItem[]; source: TrendSource; configured: boolean; reason?: "missing-config" | "no-terms" | "provider-error" | "no-data"; message: string };

const GOOGLE_TRENDS_REFERENCE = "Últimos 12 meses";
const CONFIG_ADDED_ON = "2026-08-20";

/**
 * Curadoria de fontes por plataforma.
 *
 * Os seeds de relatório são trechos conferidos manualmente nas URLs abaixo,
 * não mocks: eles só são exibidos com a origem e a data da publicação. A
 * revisão deste catálogo deve acontecer quando cada plataforma publicar uma
 * nova matéria ou relatório.
 */
const platformConfig: Record<MarketplaceId, PlatformConfig> = {
  shopee: {
    terms: ["air fryer", "creatina", "fone bluetooth", "organizador de cozinha", "kit de ferramentas"],
    reports: [{
      url: "https://shopee.com.br/blog/mais-vendidos-shopee/",
      label: "Shopee · Destaques e mais vendidos 15.3",
      referenceDate: "2026-03-24",
      addedOn: CONFIG_ADDED_ON,
      seeds: [
        { title: "Capa de chuva impermeável para moto", category: "Moda e acessórios", position: 1 },
        { title: "Creatina monohidratada", category: "Saúde e bem-estar", position: 2 },
        { title: "Air fryer oven", category: "Eletroportáteis", position: 3 },
        { title: "Liquidificador", category: "Eletroportáteis", position: 4 },
        { title: "Aspirador vertical", category: "Casa e limpeza", position: 5 },
        { title: "Escova secadora", category: "Beleza", position: 6 },
        { title: "Lavadora de alta pressão", category: "Casa e ferramentas", position: 7 },
        { title: "Jogo de taças", category: "Lar e decoração", position: 8 },
      ],
    }],
  },
  "mercado-livre": {
    terms: ["celular", "air fryer", "fone bluetooth", "câmera de segurança", "kit de ferramentas"],
    reports: [],
  },
  shein: {
    terms: ["vestido feminino", "bolsa feminina", "top fitness", "sandália feminina", "maquiagem"],
    reports: [{
      url: "https://www.mobiletime.com.br/noticias/13/02/2025/shein-vendas-marketplace/",
      label: "Mobile Time · expansão do marketplace SHEIN no Brasil",
      referenceDate: "2025-02-13",
      addedOn: CONFIG_ADDED_ON,
      seeds: [
        { title: "Vestuário feminino", category: "Moda", position: 1 },
        { title: "Vestuário masculino", category: "Moda", position: 2 },
        { title: "Calçados", category: "Moda", position: 3 },
        { title: "Artigos para casa", category: "Casa e decoração", position: 4 },
      ],
    }],
  },
  "tiktok-shop": {
    terms: ["produto viral", "body splash", "garrafa térmica", "fone de ouvido", "air fryer"],
    reports: [{
      url: "https://newsroom.tiktok.com/tiktok-shop-cresce-102-vezes-em-seu-primeiro-ano-no-brasil?lang=pt-BR",
      label: "TikTok Shop · produtos mais vendidos no primeiro ano no Brasil",
      referenceDate: "2026-06-03",
      addedOn: CONFIG_ADDED_ON,
      seeds: [
        { title: "Calças femininas", category: "Moda", position: 1 },
        { title: "Camisetas e blusinhas femininas", category: "Moda", position: 2 },
        { title: "Vestido casual feminino", category: "Moda", position: 3 },
        { title: "Bodysplash feminino", category: "Beleza", position: 4 },
        { title: "Perfume masculino", category: "Beleza", position: 5 },
        { title: "Panelas e frigideiras", category: "Casa e decoração", position: 6 },
        { title: "Lençóis e fronhas", category: "Casa e decoração", position: 7 },
        { title: "Garrafas térmicas", category: "Casa e decoração", position: 8 },
        { title: "Fones de ouvido", category: "Eletrônicos", position: 9 },
        { title: "Smart watch", category: "Eletrônicos", position: 10 },
      ],
    }],
  },
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function numericValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function sourceUrlForTerm(term: string) {
  const params = new URLSearchParams({ geo: "BR", q: term, date: "today 12-m" });
  return `https://trends.google.com/trends/explore?${params.toString()}`;
}

function categoryForTerm(platformId: MarketplaceId, term: string) {
  const value = term.toLocaleLowerCase("pt-BR");
  if (/vestido|bolsa|top|sandália|calça|camiseta|moda/.test(value)) return "Moda";
  if (/creatina|maquiagem|body splash|perfume/.test(value)) return "Beleza e bem-estar";
  if (/air fryer|organizador|garrafa|câmera|ferramenta|casa/.test(value)) return "Casa e utilidades";
  if (/fone|celular|smart|eletrônico/.test(value)) return "Eletrônicos";
  return platformId === "tiktok-shop" ? "Produtos virais" : "Categoria de produto";
}

function directionFor(values: number[]): TrendDirection {
  if (values.length < 4) return "estável";
  const midpoint = Math.max(1, Math.floor(values.length / 2));
  const previous = values.slice(0, midpoint).reduce((sum, value) => sum + value, 0) / midpoint;
  const recent = values.slice(midpoint).reduce((sum, value) => sum + value, 0) / (values.length - midpoint);
  if (recent - previous >= 5) return "subindo";
  if (previous - recent >= 5) return "caindo";
  return "estável";
}

function parseTimeline(data: Record<string, unknown>, platformId: MarketplaceId, terms: string[]): TrendItem[] {
  const trends = data.interest_over_time;
  const timeline = trends && typeof trends === "object" ? (trends as Record<string, unknown>).timeline_data : null;
  if (!Array.isArray(timeline)) return [];

  const valuesByTerm = new Map<string, number[]>();
  for (const rawPoint of timeline) {
    if (!rawPoint || typeof rawPoint !== "object") continue;
    const point = rawPoint as Record<string, unknown>;
    const values = Array.isArray(point.values) ? point.values : [];
    values.forEach((rawValue, index) => {
      if (!rawValue || typeof rawValue !== "object") return;
      const entry = rawValue as Record<string, unknown>;
      const term = cleanText(entry.query) || terms[index];
      const value = numericValue(entry.extracted_value ?? entry.value);
      if (!term || value === null) return;
      const valuesForTerm = valuesByTerm.get(term) ?? [];
      valuesForTerm.push(value);
      valuesByTerm.set(term, valuesForTerm);
    });
  }

  return Array.from(valuesByTerm.entries()).map(([term, values]) => {
    const latest = Math.round(values.at(-1) ?? 0);
    const direction = directionFor(values);
    return {
      rank: 0,
      title: term,
      category: categoryForTerm(platformId, term),
      price: "Não informado pela fonte",
      monthlySales: "Não informado pela fonte",
      growth: direction,
      imageUrl: "",
      url: sourceUrlForTerm(term),
      origin: "google-trends" as const,
      sourceLabel: "Google Trends · Brasil",
      referenceDate: GOOGLE_TRENDS_REFERENCE,
      interestIndex: latest,
      direction,
    };
  }).sort((left, right) => (right.interestIndex ?? 0) - (left.interestIndex ?? 0)).map((item, index) => {
    return { ...item, rank: index + 1 };
  });
}

async function fetchGoogleTrendsFor(platformId: MarketplaceId): Promise<TrendLookup> {
  const config = platformConfig[platformId];
  const platform = marketplaceNameFromId(platformId) ?? platformId;
  const source: TrendSource = { origin: "google-trends", label: "Google Trends · Brasil", url: sourceUrlForTerm(config.terms[0] ?? ""), referenceDate: GOOGLE_TRENDS_REFERENCE };
  if (!config.terms.length) return { items: [], source, configured: true, reason: "no-terms", message: `Nenhum termo de busca foi cadastrado para ${platform}.` };
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    console.error("[trends] SERPAPI_KEY is not configured", { stage: "configuration", platformId });
    return { items: [], source, configured: false, reason: "missing-config", message: "Google Trends não foi consultado porque SERPAPI_KEY não está configurada no ambiente de produção." };
  }

  const params = new URLSearchParams({
    engine: "google_trends",
    q: config.terms.join(","),
    data_type: "TIMESERIES",
    date: "today 12-m",
    geo: "BR",
    hl: "pt-br",
    tz: "180",
    api_key: apiKey,
  });

  let response: Response;
  try {
    response = await fetch(`https://serpapi.com/search.json?${params.toString()}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  } catch (error) {
    console.error("[trends] Google Trends request failed", { stage: "provider-network", platformId, name: error instanceof Error ? error.name : "UnknownError", message: error instanceof Error ? error.message : String(error) });
    return { items: [], source, configured: true, reason: "provider-error", message: "Não foi possível consultar o Google Trends agora." };
  }
  if (!response.ok) {
    console.error("[trends] Google Trends provider returned an error", { stage: "provider-response", platformId, status: response.status });
    if (response.status === 401 || response.status === 403) return { items: [], source, configured: true, reason: "provider-error", message: "A credencial da SerpApi foi recusada ao consultar o Google Trends." };
    if (response.status === 429) return { items: [], source, configured: true, reason: "provider-error", message: "A cota da SerpApi foi atingida ao consultar o Google Trends." };
    return { items: [], source, configured: true, reason: "provider-error", message: `O Google Trends respondeu com status ${response.status}.` };
  }

  let data: Record<string, unknown>;
  try { data = await response.json() as Record<string, unknown>; } catch (error) {
    console.error("[trends] Google Trends returned invalid JSON", { stage: "provider-json", platformId, name: error instanceof Error ? error.name : "UnknownError", message: error instanceof Error ? error.message : String(error) });
    return { items: [], source, configured: true, reason: "provider-error", message: "O Google Trends retornou uma resposta inválida." };
  }
  const items = parseTimeline(data, platformId, config.terms);
  return { items, source, configured: true, reason: items.length ? undefined : "no-data", message: items.length ? "Interesse de busca real do Google Trends no Brasil; isso não é volume de vendas." : "O Google Trends não retornou séries para os termos desta plataforma." };
}

function reportItem(seed: ReportSeed, config: ReportConfig): TrendItem {
  return {
    rank: seed.position ?? 0,
    title: seed.title,
    category: seed.category,
    price: "Não informado pela fonte",
    monthlySales: "Não informado pela fonte",
    growth: "Relatório periódico",
    imageUrl: "",
    url: config.url,
    origin: "relatorio-publicado",
    sourceLabel: config.label,
    referenceDate: config.referenceDate,
    reportPosition: seed.position,
  };
}

function parseReportJsonLd(html: string, config: ReportConfig): TrendItem[] {
  const items: TrendItem[] = [];
  const blocks = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  function visit(value: unknown) {
    if (items.length >= 20 || value === null || value === undefined) return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (typeof value !== "object") return;
    const row = value as Record<string, unknown>;
    const name = cleanText(row.name);
    const type = cleanText(row["@type"]);
    if (name && /product/i.test(type)) items.push({ ...reportItem({ title: name, category: cleanText(row.category) || "Categoria publicada" }, config), reportPosition: items.length + 1, rank: items.length + 1 });
    visit(row.itemListElement);
    visit(row.item);
  }
  for (const match of blocks) {
    try { visit(JSON.parse(match[1])); } catch { /* publicação sem JSON-LD legível */ }
    if (items.length >= 20) break;
  }
  return items;
}

async function fetchPublishedReportFor(platformId: MarketplaceId): Promise<{ items: TrendItem[]; sources: TrendSource[]; message: string }> {
  const reports = platformConfig[platformId].reports;
  if (reports.length === 0) return { items: [], sources: [], message: "Nenhum relatório periódico específico está cadastrado para esta plataforma." };

  const results = await Promise.all(reports.map(async (config) => {
    const source: TrendSource = { origin: "relatorio-publicado", label: config.label, url: config.url, referenceDate: config.referenceDate };
    let parsed: TrendItem[] = [];
    try {
      const response = await fetch(config.url, { headers: { accept: "text/html", "user-agent": "TudoDoEcommerce/1.0 (published-report-reader)" }, signal: AbortSignal.timeout(12000) });
      if (response.ok) parsed = parseReportJsonLd(await response.text(), config);
    } catch { /* o trecho curado continua disponível como relatório estático */ }
    const merged = [...config.seeds, ...parsed.map((item) => ({ title: item.title, category: item.category, position: item.reportPosition }))];
    const seen = new Set<string>();
    const items = merged.filter((item) => {
      const key = item.title.toLocaleLowerCase("pt-BR");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map((item) => reportItem(item, config));
    return { items, source };
  }));

  return { items: results.flatMap((result) => result.items), sources: results.map((result) => result.source), message: "Itens de publicações periódicas; não representam um ranking de vendas ao vivo." };
}

function combineItems(trends: TrendItem[], reports: TrendItem[]) {
  const unique = new Map<string, TrendItem>();
  [...trends, ...reports].forEach((item) => {
    const key = `${item.origin}:${item.title.toLocaleLowerCase("pt-BR")}`;
    if (!unique.has(key)) unique.set(key, item);
  });
  return Array.from(unique.values()).map((item, index) => ({ ...item, rank: index + 1 }));
}

async function fetchCombinedFor(platformId: MarketplaceId): Promise<TrendFeed> {
  const platform = marketplaceNameFromId(platformId) as Platform;
  const checkedAt = new Date().toISOString();
  const [trends, reports] = await Promise.all([fetchGoogleTrendsFor(platformId), fetchPublishedReportFor(platformId)]);
  const items = combineItems(trends.items, reports.items);
  const sources = [trends.source, ...reports.sources];
  const labels = sources.map((source) => source.label).filter((label, index, all) => all.indexOf(label) === index);
  const messages = [trends.message, reports.message].filter(Boolean);
  const sourceUrl = sources[0]?.url ?? "";
  if (!items.length) {
    return { platform, mode: "unavailable", reason: trends.reason ?? (trends.configured ? "no-data" : "missing-config"), items: [], checkedAt, sourceUrl, sourceLabel: labels.join(" + ") || "Nenhuma fonte cadastrada", sources, message: `${platform}: ${messages.join(" ")} Nenhum dado foi inventado.` };
  }
  return {
    platform,
    mode: "live",
    items,
    checkedAt,
    sourceUrl,
    sourceLabel: labels.join(" + "),
    sources,
    message: `Dados reais combinados para ${platform}. A tela mistura interesse de busca e publicações periódicas; não é um ranking de vendas em tempo real. ${messages.join(" ")}`,
  };
}

type TrendSnapshotPayload = {
  items: TrendItem[];
  source: TrendSource;
};

type TrendSnapshotRow = {
  marketplace: string;
  category: string;
  payload: string;
  origin: TrendOrigin;
  fetched_at: string;
};

const ALL_MARKETPLACES: MarketplaceId[] = ["mercado-livre", "shopee", "shein", "tiktok-shop"];

function snapshotGroups(feed: TrendFeed) {
  const groups = new Map<string, TrendItem[]>();
  for (const item of feed.items) {
    const key = `${item.origin}:${item.category}`;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

export async function refreshTrendSnapshots(db: D1Database, marketplaceIds: MarketplaceId[] = ALL_MARKETPLACES) {
  await ensureRuntimeSchema(db);
  const results: { marketplace: string; status: "saved" | "skipped"; items: number; reason?: string }[] = [];

  for (const marketplaceId of marketplaceIds) {
    const feed = await fetchCombinedFor(marketplaceId);
    const marketplace = marketplaceNameFromId(marketplaceId) ?? marketplaceId;
    if (feed.mode !== "live" || feed.items.length === 0) {
      console.warn("[trends] snapshot refresh skipped", { marketplaceId, reason: feed.reason ?? "no-data", message: feed.message });
      results.push({ marketplace, status: "skipped", items: 0, reason: feed.reason ?? "no-data" });
      continue;
    }

    const fetchedAt = feed.checkedAt;
    const groups = snapshotGroups(feed);
    const statements = [db.prepare("DELETE FROM trend_snapshots WHERE marketplace = ?").bind(marketplaceId)];
    for (const [key, items] of groups) {
      const [origin, category] = key.split(":") as [TrendOrigin, string];
      const source = feed.sources.find((candidate) => candidate.origin === origin) ?? {
        origin,
        label: items[0]?.sourceLabel ?? "Fonte não informada",
        url: items[0]?.url ?? "",
        referenceDate: items[0]?.referenceDate ?? fetchedAt,
      };
      const payload: TrendSnapshotPayload = { items, source };
      statements.push(db.prepare("INSERT INTO trend_snapshots (id, marketplace, category, payload, origin, fetched_at) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), marketplaceId, category, JSON.stringify(payload), origin, fetchedAt));
    }
    await db.batch(statements);
    results.push({ marketplace, status: "saved", items: feed.items.length });
  }

  return { refreshedAt: new Date().toISOString(), results };
}

function emptySnapshotFeed(platformId: MarketplaceId): TrendFeed {
  const platform = marketplaceNameFromId(platformId) as Platform;
  const configured = Boolean(process.env.SERPAPI_KEY);
  return {
    platform,
    mode: "unavailable",
    reason: configured ? "no-data" : "missing-config",
    items: [],
    checkedAt: new Date().toISOString(),
    sourceUrl: sourceUrlForTerm(platformConfig[platformId].terms[0] ?? ""),
    sourceLabel: "Google Trends · Brasil",
    sources: [{ origin: "google-trends", label: "Google Trends · Brasil", url: sourceUrlForTerm(platformConfig[platformId].terms[0] ?? ""), referenceDate: GOOGLE_TRENDS_REFERENCE }],
    message: configured
      ? `${platform}: aguardando a primeira coleta automática de tendências. Nenhum dado foi inventado.`
      : `${platform}: SERPAPI_KEY ainda não está configurada; a coleta automática não pode consultar o Google Trends. Nenhum dado foi inventado.`,
  };
}

async function readTrendSnapshotFeed(db: D1Database, platformId: MarketplaceId): Promise<TrendFeed | null> {
  await ensureRuntimeSchema(db);
  const rows = await db.prepare("SELECT marketplace, category, payload, origin, fetched_at FROM trend_snapshots WHERE marketplace = ? ORDER BY fetched_at DESC").bind(platformId).all<TrendSnapshotRow>();
  if (!rows.results?.length) return null;

  const items: TrendItem[] = [];
  const sources = new Map<string, TrendSource>();
  let fetchedAt = rows.results[0].fetched_at;
  for (const row of rows.results) {
    if (row.fetched_at > fetchedAt) fetchedAt = row.fetched_at;
    try {
      const payload = JSON.parse(row.payload) as TrendSnapshotPayload;
      if (Array.isArray(payload.items)) items.push(...payload.items);
      if (payload.source?.url) sources.set(`${payload.source.origin}:${payload.source.url}`, payload.source);
    } catch (error) {
      console.error("[trends] invalid snapshot payload", { stage: "snapshot-read", marketplaceId: platformId, name: error instanceof Error ? error.name : "UnknownError" });
    }
  }
  if (!items.length) return null;
  const platform = marketplaceNameFromId(platformId) as Platform;
  const orderedItems = items.sort((left, right) => (right.interestIndex ?? 0) - (left.interestIndex ?? 0)).map((item, index) => ({ ...item, rank: index + 1 }));
  const sourceList = Array.from(sources.values());
  return {
    platform,
    mode: "cache",
    items: orderedItems,
    checkedAt: fetchedAt,
    cachedAt: fetchedAt,
    sourceUrl: sourceList[0]?.url ?? orderedItems[0]?.url ?? "",
    sourceLabel: sourceList.map((source) => source.label).filter((label, index, all) => all.indexOf(label) === index).join(" + "),
    sources: sourceList,
    message: `Última atualização automática de ${platform}: ${new Date(fetchedAt).toLocaleString("pt-BR")}. Os dados combinam interesse de busca e publicações periódicas; não são vendas ao vivo.`,
  };
}

export async function GET(request: Request) {
  const rawPlatform = new URL(request.url).searchParams.get("platform") ?? "";
  const platformId = rawPlatform in platformConfig ? rawPlatform as MarketplaceId : marketplaceIdFromName(rawPlatform);
  if (!platformId) return Response.json({ error: "Plataforma inválida." }, { status: 400 });

  const db = await getRuntimeDb();
  if (!db) return persistencePendingResponse();
  const snapshot = await readTrendSnapshotFeed(db, platformId);
  return Response.json(snapshot ?? emptySnapshotFeed(platformId));
}

export async function POST(request: Request) {
  const rawPlatform = new URL(request.url).searchParams.get("platform") ?? "";
  const platformId = rawPlatform ? (rawPlatform in platformConfig ? rawPlatform as MarketplaceId : marketplaceIdFromName(rawPlatform)) : null;
  const targets = platformId ? [platformId] : ALL_MARKETPLACES;
  const db = await getRuntimeDb();
  if (!db) return persistencePendingResponse();
  const summary = await refreshTrendSnapshots(db, targets);
  const requestedFeed = platformId ? await readTrendSnapshotFeed(db, platformId) : null;
  return Response.json({ ...(requestedFeed ?? (platformId ? emptySnapshotFeed(platformId) : { refreshedAt: summary.refreshedAt })), refreshSummary: summary, forced: true });
}
