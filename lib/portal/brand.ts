/**
 * Identidade do portal.
 *
 * O nome nasce do sobrenome do dono do veículo (Mello): "Diário Mello" é a
 * marca usada no cabeçalho, nos metadados de SEO e nas mensagens do painel.
 * Tudo o que for texto de marca deve sair daqui, nunca ficar solto em JSX.
 */
export const BRAND = {
  /** Nome completo, usado em títulos e Open Graph. */
  name: "Diário Mello",
  /** Primeira palavra do logo (fica em preto). */
  nameFirst: "Diário",
  /** Sobrenome da família, destaque em vermelho no logo. */
  nameLast: "Mello",
  /** Sigla usada no selo quadrado do cabeçalho e no favicon. */
  initials: "DM",
  tagline: "Jornalismo independente, todos os dias.",
  description:
    "Diário Mello: notícias de política, economia, esportes, cultura, internacional, tecnologia e opinião com apuração própria.",
  /** Vermelho de jornal tradicional — cor de destaque do portal. */
  accent: "#c8102e",
  locale: "pt-BR",
  /** Assinatura padrão das matérias sem autor definido. */
  defaultAuthorName: "Redação Diário Mello",
  founderSurname: "Mello",
  email: "redacao@diariomello.com.br",
} as const;

/**
 * URL pública do site. Em produção o host chega pelo próprio request; o valor
 * abaixo é só o fallback para sitemap/Open Graph quando não há request.
 */
export const SITE_URL_FALLBACK = "https://diariomello.com.br";

/** Monta a URL absoluta de uma matéria/página a partir do host da requisição. */
export function absoluteUrl(path: string, origin?: string | null) {
  const base = (origin ?? SITE_URL_FALLBACK).replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
