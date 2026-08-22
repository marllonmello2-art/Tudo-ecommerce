export type MarketplaceId = "mercado-livre" | "shopee" | "shein" | "tiktok-shop";

export const marketplaceNameById: Record<MarketplaceId, string> = {
  "mercado-livre": "Mercado Livre",
  shopee: "Shopee",
  shein: "SHEIN",
  "tiktok-shop": "TikTok Shop",
};

export const marketplaceIdByName: Record<string, MarketplaceId> = {
  "Mercado Livre": "mercado-livre",
  MercadoLivre: "mercado-livre",
  "mercado-livre": "mercado-livre",
  ML: "mercado-livre",
  Shopee: "shopee",
  SHEIN: "shein",
  "TikTok Shop": "tiktok-shop",
  TikTokShop: "tiktok-shop",
  "tiktok-shop": "tiktok-shop",
};

export function marketplaceIdFromName(value: string) {
  return marketplaceIdByName[value] ?? null;
}

export function marketplaceNameFromId(value: string) {
  return marketplaceNameById[value as MarketplaceId] ?? null;
}
