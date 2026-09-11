import Link from "next/link";
import { PortalShell } from "../components/portal/PortalShell";

export default function NotFound() {
  return (
    <PortalShell>
      <div className="dm-wrap">
        <header className="dm-page-head">
          <span className="dm-kicker">Erro 404</span>
          <h1 className="dm-page-title">Página não encontrada</h1>
          <p className="dm-page-sub">
            O endereço acessado não existe ou a matéria saiu do ar.{" "}
            <Link href="/">Voltar para a capa</Link>.
          </p>
        </header>
      </div>
    </PortalShell>
  );
}
