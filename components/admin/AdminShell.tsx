import Link from "next/link";
import { BRAND } from "../../lib/portal/brand";
import { LogoutButton } from "./LogoutButton";

/** Moldura do painel: barra de navegação + área de conteúdo. */
export function AdminShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { email: string; name: string | null };
}) {
  return (
    <div className="dm-admin">
      <div className="dm-admin-bar">
        <div className="dm-wrap">
          <Link href="/admin" className="dm-logo">
            <span className="dm-logo-mark" aria-hidden="true">
              {BRAND.initials}
            </span>
            <span className="dm-logo-text">
              {BRAND.nameFirst} <em>{BRAND.nameLast}</em>
            </span>
          </Link>
          <nav>
            <Link href="/admin">Matérias</Link>
            <Link href="/admin/editorias">Editorias</Link>
            <Link href="/admin/autores">Autores</Link>
            <Link href="/" target="_blank">
              Ver o site ↗
            </Link>
          </nav>
          <LogoutButton label={user.name || user.email} />
        </div>
      </div>
      <div className="dm-admin-main">{children}</div>
    </div>
  );
}
