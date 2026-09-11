import type { Metadata } from "next";
import { PortalShell } from "../../components/portal/PortalShell";
import { BRAND } from "../../lib/portal/brand";

export const metadata: Metadata = {
  title: "Expediente",
  description: `Expediente do ${BRAND.name}.`,
};

export default function MastheadPage() {
  return (
    <PortalShell>
      <div className="dm-wrap">
        <header className="dm-page-head">
          <span className="dm-kicker">Institucional</span>
          <h1 className="dm-page-title">Expediente</h1>
        </header>
        <div className="dm-static dm-prose">
          <p>
            <strong>{BRAND.name}</strong> — {BRAND.tagline}
          </p>
          <p>
            Direção e edição: família {BRAND.founderSurname}.
            <br />
            Redação: {BRAND.defaultAuthorName}.
            <br />
            Contato: {BRAND.email}.
          </p>
          <p>
            Os textos assinados por colunistas expressam a opinião de seus autores e não
            necessariamente a do portal.
          </p>
        </div>
      </div>
    </PortalShell>
  );
}
