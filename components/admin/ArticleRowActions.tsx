"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Ações rápidas de cada linha da lista: publicar, voltar a rascunho, excluir. */
export function ArticleRowActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    await fetch(`/api/admin/articles/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    router.refresh();
  }

  async function remove() {
    if (!window.confirm("Excluir esta matéria? A ação não pode ser desfeita.")) return;
    setBusy(true);
    await fetch(`/api/admin/articles/${id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="dm-actions">
      {status === "published" ? (
        <button type="button" className="dm-btn dm-btn-ghost" disabled={busy} onClick={() => patch({ status: "draft" })}>
          Despublicar
        </button>
      ) : (
        <button type="button" className="dm-btn" disabled={busy} onClick={() => patch({ status: "published" })}>
          Publicar
        </button>
      )}
      <button type="button" className="dm-btn dm-btn-ghost" disabled={busy} onClick={remove}>
        Excluir
      </button>
    </div>
  );
}
