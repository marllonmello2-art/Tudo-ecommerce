import type { Metadata } from "next";
import "./globals.css";
import { requireChatGPTUser } from "./chatgpt-auth";
import { SessionProvider } from "./session-context";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tudo do Ecommerce · Central de vendas",
  description: "Crie anúncios melhores e precifique seus produtos para marketplaces.",
  other: { "codex-preview": "development" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireChatGPTUser("/");
  return <html lang="pt-BR"><body><SessionProvider user={user}>{children}</SessionProvider></body></html>;
}
