import type { Metadata } from "next";
import "../globals.css";
import { requireChatGPTUser } from "../chatgpt-auth";
import { SessionProvider } from "./session-context";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tudo do Ecommerce · Central de vendas",
  description: "Crie anúncios melhores e precifique seus produtos para marketplaces.",
};

/**
 * Área logada da ferramenta de ecommerce.
 *
 * O login por ChatGPT vive aqui (e não no layout raiz) porque o portal de
 * notícias precisa ser público — só esta subárvore exige usuário autenticado.
 */
export default async function MarketlabLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireChatGPTUser("/marketlab");
  return <SessionProvider user={user}>{children}</SessionProvider>;
}
