import Link from "next/link";
import { BRAND } from "../../lib/portal/brand";
import type { NavItem } from "./SiteHeader";

/** Rodapé institucional com editorias e links de serviço. */
export function SiteFooter({ categories }: { categories: NavItem[] }) {
  return (
    <footer className="dm-footer">
      <div className="dm-wrap">
        <div className="dm-footer-grid">
          <div>
            <div className="dm-footer-brand">
              {BRAND.nameFirst} <em>{BRAND.nameLast}</em>
            </div>
            <p style={{ marginTop: 12, maxWidth: 320 }}>
              {BRAND.tagline} Um portal da família {BRAND.founderSurname}, feito para quem quer
              entender a notícia — e não só ler a manchete.
            </p>
          </div>

          <div>
            <h4>Editorias</h4>
            <ul>
              {categories.slice(0, 7).map((category) => (
                <li key={category.slug}>
                  <Link href={`/editoria/${category.slug}`}>{category.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4>Institucional</h4>
            <ul>
              <li><Link href="/sobre">Quem somos</Link></li>
              <li><Link href="/contato">Fale com a redação</Link></li>
              <li><Link href="/privacidade">Privacidade</Link></li>
              <li><Link href="/expediente">Expediente</Link></li>
            </ul>
          </div>

          <div>
            <h4>Serviços</h4>
            <ul>
              <li><Link href="/busca">Busca</Link></li>
              <li><Link href="/sitemap.xml">Mapa do site</Link></li>
              <li><Link href="/admin">Painel do editor</Link></li>
            </ul>
          </div>
        </div>

        <div className="dm-footer-bottom">
          <span>
            © {new Date().getFullYear()} {BRAND.name}. Todos os direitos reservados.
          </span>
          <span>{BRAND.email}</span>
        </div>
      </div>
    </footer>
  );
}
