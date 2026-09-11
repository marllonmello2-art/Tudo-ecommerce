"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Img } from "../portal/Img";

export type AuthorRow = {
  id: string;
  name: string;
  bio: string | null;
  email: string | null;
  avatarUrl: string | null;
};

/** CRUD de autores: nome, bio, e-mail e foto (enviada para o R2). */
export function AuthorManager({ authors }: { authors: AuthorRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function call(input: RequestInfo, init: RequestInit) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(input, init);
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Não foi possível salvar.");
      router.refresh();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro inesperado.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const ok = await call("/api/admin/authors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, bio }),
    });
    if (ok) {
      setName("");
      setBio("");
    }
  }

  return (
    <>
      <div className="dm-panel">
        <h2>Novo autor</h2>
        <form onSubmit={create}>
          <div className="dm-row">
            <div className="dm-field">
              <label htmlFor="dm-author-name">Nome</label>
              <input
                id="dm-author-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
            <div className="dm-field">
              <label htmlFor="dm-author-bio">Bio</label>
              <input id="dm-author-bio" value={bio} onChange={(event) => setBio(event.target.value)} />
            </div>
          </div>
          <button type="submit" className="dm-btn" disabled={busy}>
            Adicionar autor
          </button>
        </form>
        {error ? <p className="dm-note dm-note-error">{error}</p> : null}
      </div>

      {authors.map((author) => (
        <AuthorCard key={author.id} author={author} onCall={call} busy={busy} />
      ))}
    </>
  );
}

function AuthorCard({
  author,
  onCall,
  busy,
}: {
  author: AuthorRow;
  onCall: (input: RequestInfo, init: RequestInit) => Promise<boolean>;
  busy: boolean;
}) {
  const [draft, setDraft] = useState(author);
  const [uploading, setUploading] = useState(false);

  async function uploadAvatar(file: File) {
    setUploading(true);
    const form = new FormData();
    form.set("file", file);
    form.set("kind", "autor");
    const response = await fetch("/api/admin/upload", { method: "POST", body: form });
    const data = (await response.json()) as { url?: string };
    if (data.url) setDraft((current) => ({ ...current, avatarUrl: data.url as string }));
    setUploading(false);
  }

  const remove = () => {
    if (!window.confirm(`Excluir o autor "${author.name}"?`)) return;
    void onCall(`/api/admin/authors/${author.id}`, { method: "DELETE" });
  };

  return (
    <div className="dm-panel">
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {draft.avatarUrl ? (
          <Img src={draft.avatarUrl} alt={draft.name} className="dm-avatar" />
        ) : (
          <span className="dm-avatar-fallback" aria-hidden="true">
            {draft.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div style={{ flex: 1 }}>
          <div className="dm-row">
            <div className="dm-field">
              <label>Nome</label>
              <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            </div>
            <div className="dm-field">
              <label>E-mail</label>
              <input
                value={draft.email ?? ""}
                onChange={(event) => setDraft({ ...draft, email: event.target.value })}
              />
            </div>
          </div>
          <div className="dm-field">
            <label>Bio</label>
            <input value={draft.bio ?? ""} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} />
          </div>
          <div className="dm-field">
            <label>Foto</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadAvatar(file);
              }}
            />
            {uploading ? <small>Enviando…</small> : null}
          </div>
          <div className="dm-actions">
            <button
              type="button"
              className="dm-btn"
              disabled={busy}
              onClick={() =>
                void onCall(`/api/admin/authors/${author.id}`, {
                  method: "PATCH",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify(draft),
                })
              }
            >
              Salvar
            </button>
            <button type="button" className="dm-btn dm-btn-ghost" disabled={busy} onClick={remove}>
              Excluir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
