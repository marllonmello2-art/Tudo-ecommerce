import type { Metadata } from "next";
import { PortalShell } from "../../components/portal/PortalShell";
import { BRAND } from "../../lib/portal/brand";

export const metadata: Metadata = {
  title: "Quem somos",
  description: `Conheça o ${BRAND.name}, portal de notícias da família ${BRAND.founderSurname}.`,
};

export default function AboutPage() {
  return (
    <PortalShell>
      <div className="dm-wrap">
        <header className="dm-page-head">
          <span className="dm-kicker">Institucional</span>
          <h1 className="dm-page-title">Quem somos</h1>
        </header>
        <div className="dm-static dm-prose">
          <p>
            O <strong>{BRAND.name}</strong> leva o sobrenome da família {BRAND.founderSurname} porque
            nasce de um compromisso pessoal: publicar apenas o que a redação consegue apurar e
            sustentar. O nome na porta é o mesmo que assina cada edição.
          </p>
          <h2>O que cobrimos</h2>
          <p>
            Política, economia, esportes, cultura, internacional, tecnologia e opinião — com destaque
            diário na capa e uma newsletter que resume o que importou no dia.
          </p>
          <h2>Como trabalhamos</h2>
          <p>
            Toda matéria traz autor, data e editoria. Correções são feitas no próprio texto, de forma
            transparente. Sugestões de pauta e respostas podem ser enviadas para {BRAND.email}.
          </p>
        </div>
      </div>
    </PortalShell>
  );
}
