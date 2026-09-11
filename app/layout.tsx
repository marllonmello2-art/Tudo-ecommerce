import type { Metadata } from "next";
import "./portal.css";
import { BRAND, SITE_URL_FALLBACK } from "../lib/portal/brand";

export const dynamic = "force-dynamic";

/**
 * Metadados padrão do portal. Cada matéria sobrescreve título, descrição e
 * imagem em `generateMetadata`, mantendo o template "Título · Diário Mello".
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL_FALLBACK),
  title: { default: `${BRAND.name} · ${BRAND.tagline}`, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
  applicationName: BRAND.name,
  other: { "codex-preview": "development" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    locale: "pt_BR",
    title: BRAND.name,
    description: BRAND.description,
  },
  twitter: { card: "summary_large_image", title: BRAND.name, description: BRAND.description },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
