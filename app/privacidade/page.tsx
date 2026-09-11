import type { Metadata } from "next";
import { PortalShell } from "../../components/portal/PortalShell";
import { BRAND } from "../../lib/portal/brand";

export const metadata: Metadata = {
  title: "Privacidade",
  description: `Como o ${BRAND.name} trata os dados dos leitores.`,
};

export default function PrivacyPage() {
  return (
    <PortalShell>
      <div className="dm-wrap">
        <header className="dm-page-head">
          <span className="dm-kicker">Institucional</span>
          <h1 className="dm-page-title">Privacidade</h1>
        </header>
        <div className="dm-static dm-prose">
          <h2>Newsletter</h2>
          <p>
            Ao assinar a newsletter, guardamos apenas o e-mail informado, usado exclusivamente para
            enviar o resumo de notícias. O cancelamento pode ser pedido a qualquer momento por{" "}
            {BRAND.email}.
          </p>
          <h2>Contadores</h2>
          <p>
            Registramos o número de visualizações de cada matéria de forma agregada, sem identificar
            o leitor.
          </p>
          <h2>Painel administrativo</h2>
          <p>
            O acesso à área de publicação é protegido por senha e por sessão assinada, restrita à
            equipe do {BRAND.name}.
          </p>
        </div>
      </div>
    </PortalShell>
  );
}
