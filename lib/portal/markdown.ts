/**
 * Renderizador de Markdown próprio (sem dependências externas).
 *
 * SEGURANÇA: todo o texto é escapado ANTES de qualquer conversão, e só as tags
 * geradas aqui chegam ao HTML final. Isso significa que HTML colado dentro da
 * matéria aparece como texto, nunca como marcação executável — é o que impede
 * XSS vindo do editor do painel ou da rota /api/publish.
 */

const ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPE[char]);
}

/** Só aceitamos links http(s), mailto e caminhos internos. */
function safeUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  if (/^(https?:\/\/|mailto:|\/)/i.test(url)) return url;
  return null;
}

function inline(text: string): string {
  let out = escapeHtml(text);

  // `código`
  out = out.replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`);

  // ![alt](src)
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (match, alt, src) => {
    const href = safeUrl(src);
    return href ? `<img src="${href}" alt="${alt}" loading="lazy" />` : match;
  });

  // [texto](url)
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, src) => {
    const href = safeUrl(src);
    if (!href) return match;
    const external = /^https?:\/\//i.test(href);
    const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${href}"${attrs}>${label}</a>`;
  });

  // **negrito** e *itálico*
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");

  return out;
}

/** Converte Markdown (ou HTML já escapado) em HTML pronto para exibição. */
export function renderMarkdown(source: string): string {
  const lines = (source ?? "").replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let paragraph: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  let quote: string[] = [];
  let code: { lang: string; lines: string[] } | null = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${inline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    const items = list.items.map((item) => `<li>${inline(item)}</li>`).join("");
    html.push(`<${list.type}>${items}</${list.type}>`);
    list = null;
  };
  const flushQuote = () => {
    if (!quote.length) return;
    html.push(`<blockquote><p>${inline(quote.join(" "))}</p></blockquote>`);
    quote = [];
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (code) {
      if (line.trim().startsWith("```")) {
        html.push(`<pre><code>${escapeHtml(code.lines.join("\n"))}</code></pre>`);
        code = null;
      } else {
        code.lines.push(rawLine);
      }
      continue;
    }

    if (line.trim().startsWith("```")) {
      flushAll();
      code = { lang: line.trim().slice(3).trim(), lines: [] };
      continue;
    }

    if (!line.trim()) {
      flushAll();
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushAll();
      // O h1 da página é o título da matéria, então "#" no corpo vira h2.
      const level = Math.min(Math.max(heading[1].length, 2), 6);
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^([-*_])\1{2,}$/.test(line.trim())) {
      flushAll();
      html.push("<hr />");
      continue;
    }

    const quoted = /^>\s?(.*)$/.exec(line);
    if (quoted) {
      flushParagraph();
      flushList();
      quote.push(quoted[1]);
      continue;
    }

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      flushQuote();
      if (!list || list.type !== "ul") {
        flushList();
        list = { type: "ul", items: [] };
      }
      list.items.push(bullet[1]);
      continue;
    }

    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      flushParagraph();
      flushQuote();
      if (!list || list.type !== "ol") {
        flushList();
        list = { type: "ol", items: [] };
      }
      list.items.push(numbered[1]);
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(line.trim());
  }

  if (code) html.push(`<pre><code>${escapeHtml(code.lines.join("\n"))}</code></pre>`);
  flushAll();

  return html.join("\n");
}

/** Texto puro (sem marcação) — usado em meta description e chamadas. */
export function plainText(source: string): string {
  return (source ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Resumo curto para cards e meta tags. */
export function excerpt(source: string, limit = 180): string {
  const text = plainText(source);
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).replace(/\s+\S*$/, "")}…`;
}

/** Tempo estimado de leitura, em minutos (200 palavras/min). */
export function readingMinutes(source: string): number {
  const words = plainText(source).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
