"use client";

import { useState } from "react";
import Link from "next/link";
import { BRAND } from "../../lib/portal/brand";

export type NavItem = { name: string; slug: string };

/**
 * Cabeçalho do site: barra superior com a data, marca, busca e o menu de
 * editorias. Em telas pequenas o menu vira um botão hambúrguer — por isso o
 * componente é client-side.
 */
export function SiteHeader({ categories, today }: { categories: NavItem[]; today: string }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header>
      <div className="dm-topbar">
        <div className="dm-wrap">
          <span className="dm-topbar-date">{today}</span>
          <div className="dm-topbar-links">
            <Link href="/sobre">Quem somos</Link>
            <Link href="/contato">Contato</Link>
            <Link href="/admin">Painel</Link>
          </div>
        </div>
      </div>

      <div className="dm-masthead">
        <div className="dm-wrap">
          <button
            type="button"
            className="dm-burger"
            aria-label="Abrir menu de editorias"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            ☰
          </button>

          <Link href="/" className="dm-logo">
            <span className="dm-logo-mark" aria-hidden="true">
              {BRAND.initials}
            </span>
            <span>
              <span className="dm-logo-text">
                {BRAND.nameFirst} <em>{BRAND.nameLast}</em>
              </span>
              <span className="dm-tagline">{BRAND.tagline}</span>
            </span>
          </Link>

          <form className="dm-search" action="/busca" method="get" role="search">
            <input type="search" name="q" placeholder="Buscar notícias" aria-label="Buscar notícias" />
            <button type="submit" aria-label="Buscar">
              ⌕
            </button>
          </form>
        </div>
      </div>

      <nav className="dm-nav" aria-label="Editorias">
        <div className="dm-wrap">
          <Link href="/" className="dm-nav-home">
            Capa
          </Link>
          {categories.map((category) => (
            <Link key={category.slug} href={`/editoria/${category.slug}`}>
              {category.name}
            </Link>
          ))}
        </div>
      </nav>

      <div className={`dm-mobile-panel${menuOpen ? " dm-open" : ""}`}>
        <ul>
          <li>
            <Link href="/" onClick={() => setMenuOpen(false)}>
              Capa
            </Link>
          </li>
          {categories.map((category) => (
            <li key={category.slug}>
              <Link href={`/editoria/${category.slug}`} onClick={() => setMenuOpen(false)}>
                {category.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
