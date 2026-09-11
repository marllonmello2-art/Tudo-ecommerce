import type { Metadata } from "next";
import { PortalShell } from "../../components/portal/PortalShell";
import { BRAND } from "../../lib/portal/brand";

export const metadata: Metadata = {
  title: "Contato",
  description: `Fale com a redação do ${BRAND.name}.`,
};

export default function ContactPage() {
  return (
    <PortalShell>
      <div className="dm-wrap">
        <header className="dm-page-head">
          <span className="dm-kicker">Institucional</span>
          <h1 className="dm-page-title">Fale com a redação</h1>
        </header>
        <div className="dm-static dm-prose">
          <p>
            Sugestões de pauta, correções e direito de resposta: <strong>{BRAND.email}</strong>.
          </p>
          <h2>Correções</h2>
          <p>
            Encontrou um erro? Escreva informando o link da matéria. Correções relevantes são
            registradas no próprio texto.
          </p>
          <h2>Publicidade</h2>
          <p>Para anunciar no {BRAND.name}, use o mesmo e-mail com o assunto “Publicidade”.</p>
        </div>
      </div>
    </PortalShell>
  );
}
