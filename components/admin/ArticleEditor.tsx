"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Link from "next/link";
import { renderMarkdown } from "../../lib/portal/markdown";
import { toLocalInput } from "../../lib/portal/format";
import { Img } from "../portal/Img";

type Option = { id: string; name: string };

export type EditorArticle = {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  content: string;
  coverImageUrl: string | null;
  coverCredit: string | null;
  categoryId: string | null;
  authorId: string | null;
  status: string;
  featured: number;
  publishedAt: string | null;
};

/**
 * Editor de matéria (criação e edição).
 *
 * O texto é escrito em Markdown e a pré-visualização usa o mesmo renderizador
 * do site, então o que aparece aqui é o que vai ao ar.
 */
export function ArticleEditor({
  categories,
  authors,
  article,
  initialTags,
}: {
  categories: Option[];
  authors: Option[];
  article?: EditorArticle;
  initialTags?: string[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(article?.title ?? "");
  const [subtitle, setSubtitle] = useState(article?.subtitle ?? "");
  const [content, setContent] = useState(article?.content ?? "");
  const [categoryId, setCategoryId] = useState(article?.categoryId ?? "");
  const [authorId, setAuthorId] = useState(article?.authorId ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(article?.coverImageUrl ?? "");
  const [coverCredit, setCoverCredit] = useState(article?.coverCredit ?? "");
  const [tags, setTags] = useState((initialTags ?? []).join(", "));
  const [featured, setFeatured] = useState(Boolean(article?.featured));
  const [scheduleAt, setScheduleAt] = useState(
    article?.status === "scheduled" ? toLocalInput(article.publishedAt) : "",
  );
  const [tab, setTab] = useState<"editor" | "preview">("editor");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const preview = useMemo(() => renderMarkdown(content), [content]);

  async function uploadCover(file: File) {
    setBusy("upload");
    setMessage(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("kind", "capa");
      const response = await fetch("/api/admin/upload", { method: "POST", body: form });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error ?? "Falha no upload.");
      setCoverImageUrl(data.url);
      setMessage({ type: "ok", text: "Imagem de capa enviada." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Falha no upload." });
    } finally {
      setBusy("");
    }
  }

  async function save(status: "draft" | "published" | "scheduled") {
    if (!title.trim() || !content.trim()) {
      setMessage({ type: "error", text: "Título e texto são obrigatórios." });
      return;
    }
    if (status === "scheduled" && !scheduleAt) {
      setMessage({ type: "error", text: "Escolha a data e a hora do agendamento." });
      return;
    }

    setBusy(status);
    setMessage(null);
    const payload = {
      title,
      subtitle,
      content,
      categoryId: categoryId || null,
      authorId: authorId || null,
      coverImageUrl: coverImageUrl || null,
      coverCredit: coverCredit || null,
      tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      status,
      publishedAt: status === "scheduled" ? new Date(scheduleAt).toISOString() : undefined,
      featured,
    };

    try {
      const response = await fetch(
        article ? `/api/admin/articles/${article.id}` : "/api/admin/articles",
        {
          method: article ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await response.json()) as { error?: string; article?: { id: string } };
      if (!response.ok) throw new Error(data.error ?? "Não foi possível salvar.");

      if (!article && data.article?.id) {
        router.replace(`/admin/materias/${data.article.id}`);
        router.refresh();
        return;
      }
      setMessage({
        type: "ok",
        text:
          status === "published"
            ? "Matéria publicada."
            : status === "scheduled"
              ? "Agendamento salvo."
              : "Rascunho salvo.",
      });
      router.refresh();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Erro ao salvar." });
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <div className="dm-admin-head">
        <h1>{article ? "Editar matéria" : "Nova matéria"}</h1>
        <div className="dm-actions">
          {article && article.status === "published" ? (
            <Link href={`/noticia/${article.slug}`} target="_blank" className="dm-btn dm-btn-ghost">
              Ver no site ↗
            </Link>
          ) : null}
          <button type="button" className="dm-btn dm-btn-ghost" disabled={Boolean(busy)} onClick={() => save("draft")}>
            {busy === "draft" ? "Salvando…" : "Salvar rascunho"}
          </button>
          <button type="button" className="dm-btn" disabled={Boolean(busy)} onClick={() => save("published")}>
            {busy === "published" ? "Publicando…" : "Publicar"}
          </button>
        </div>
      </div>

      {message ? (
        <p className={`dm-note ${message.type === "error" ? "dm-note-error" : "dm-note-ok"}`}>
          {message.text}
        </p>
      ) : null}

      <div className="dm-editor-layout">
        <div className="dm-panel">
          <div className="dm-field">
            <label htmlFor="dm-title">Título</label>
            <input id="dm-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>

          <div className="dm-field">
            <label htmlFor="dm-subtitle">Linha fina</label>
            <input
              id="dm-subtitle"
              value={subtitle}
              onChange={(event) => setSubtitle(event.target.value)}
              placeholder="Resumo de uma linha que aparece abaixo do título"
            />
          </div>

          <div className="dm-toolbar" role="tablist">
            <button
              type="button"
              className={`dm-btn ${tab === "editor" ? "" : "dm-btn-ghost"}`}
              onClick={() => setTab("editor")}
            >
              Texto (Markdown)
            </button>
            <button
              type="button"
              className={`dm-btn ${tab === "preview" ? "" : "dm-btn-ghost"}`}
              onClick={() => setTab("preview")}
            >
              Pré-visualizar
            </button>
          </div>

          {tab === "editor" ? (
            <div className="dm-field">
              <label htmlFor="dm-content">Corpo da matéria</label>
              <textarea
                id="dm-content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder={"## Subtítulo\n\nEscreva aqui. **Negrito**, *itálico*, [links](https://exemplo.com), listas e citações com >."}
              />
              <small>Markdown: ## subtítulo · **negrito** · *itálico* · - lista · &gt; citação</small>
            </div>
          ) : (
            <div className="dm-prose" dangerouslySetInnerHTML={{ __html: preview }} />
          )}
        </div>

        <aside>
          <div className="dm-panel">
            <h2>Publicação</h2>
            <div className="dm-field">
              <label htmlFor="dm-category">Editoria</label>
              <select id="dm-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                <option value="">Sem editoria</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="dm-field">
              <label htmlFor="dm-author">Autor</label>
              <select id="dm-author" value={authorId} onChange={(event) => setAuthorId(event.target.value)}>
                <option value="">Sem assinatura</option>
                {authors.map((author) => (
                  <option key={author.id} value={author.id}>
                    {author.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="dm-field">
              <label htmlFor="dm-tags">Tags</label>
              <input
                id="dm-tags"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="eleições, orçamento, câmara"
              />
              <small>Separe por vírgula.</small>
            </div>

            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, marginBottom: 14 }}>
              <input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} />
              Destaque principal da capa
            </label>

            <div className="dm-field">
              <label htmlFor="dm-schedule">Agendar para</label>
              <input
                id="dm-schedule"
                type="datetime-local"
                value={scheduleAt}
                onChange={(event) => setScheduleAt(event.target.value)}
              />
              <button
                type="button"
                className="dm-btn dm-btn-ghost"
                style={{ marginTop: 8 }}
                disabled={Boolean(busy)}
                onClick={() => save("scheduled")}
              >
                {busy === "scheduled" ? "Agendando…" : "Agendar publicação"}
              </button>
            </div>
          </div>

          <div className="dm-panel">
            <h2>Imagem de capa</h2>
            {coverImageUrl ? (
              <Img src={coverImageUrl} alt="Pré-visualização da capa" className="dm-cover-preview" />
            ) : (
              <div className="dm-cover-preview" />
            )}
            <div className="dm-field" style={{ marginTop: 12 }}>
              <label htmlFor="dm-cover-file">Enviar imagem (R2)</label>
              <input
                id="dm-cover-file"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadCover(file);
                }}
              />
              {busy === "upload" ? <small>Enviando…</small> : null}
            </div>
            <div className="dm-field">
              <label htmlFor="dm-cover-url">Ou cole uma URL</label>
              <input
                id="dm-cover-url"
                value={coverImageUrl}
                onChange={(event) => setCoverImageUrl(event.target.value)}
                placeholder="https://…"
              />
            </div>
            <div className="dm-field">
              <label htmlFor="dm-cover-credit">Crédito da foto</label>
              <input
                id="dm-cover-credit"
                value={coverCredit}
                onChange={(event) => setCoverCredit(event.target.value)}
                placeholder="Foto: Nome do fotógrafo"
              />
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
