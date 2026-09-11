"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type CategoryRow = { id: string; name: string; slug: string; color: string; position: number };

/** CRUD de editorias: nome, endereço (slug), cor da tag e ordem no menu. */
export function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#c8102e");
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
    const ok = await call("/api/admin/categories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, color, position: categories.length }),
    });
    if (ok) setName("");
  }

  return (
    <>
      <div className="dm-panel">
        <h2>Nova editoria</h2>
        <form className="dm-toolbar" onSubmit={create}>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nome da editoria"
            required
          />
          <input
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            aria-label="Cor da tag"
            style={{ width: 52, padding: 4 }}
          />
          <button type="submit" className="dm-btn" disabled={busy}>
            Adicionar
          </button>
        </form>
        {error ? <p className="dm-note dm-note-error">{error}</p> : null}
      </div>

      <div className="dm-panel">
        <table className="dm-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Endereço</th>
              <th>Cor</th>
              <th>Ordem</th>
              <th aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <CategoryRowItem key={category.id} category={category} onCall={call} busy={busy} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CategoryRowItem({
  category,
  onCall,
  busy,
}: {
  category: CategoryRow;
  onCall: (input: RequestInfo, init: RequestInit) => Promise<boolean>;
  busy: boolean;
}) {
  const [draft, setDraft] = useState(category);

  const save = () =>
    onCall(`/api/admin/categories/${category.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });

  const remove = () => {
    if (!window.confirm(`Excluir a editoria "${category.name}"? As matérias ficam sem editoria.`)) return;
    void onCall(`/api/admin/categories/${category.id}`, { method: "DELETE" });
  };

  return (
    <tr>
      <td>
        <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
      </td>
      <td>
        <input value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value })} />
      </td>
      <td>
        <input
          type="color"
          value={draft.color}
          onChange={(event) => setDraft({ ...draft, color: event.target.value })}
          style={{ width: 46, padding: 3 }}
        />
      </td>
      <td>
        <input
          type="number"
          value={draft.position}
          onChange={(event) => setDraft({ ...draft, position: Number(event.target.value) })}
          style={{ width: 70 }}
        />
      </td>
      <td>
        <div className="dm-actions">
          <button type="button" className="dm-btn" disabled={busy} onClick={() => void save()}>
            Salvar
          </button>
          <button type="button" className="dm-btn dm-btn-ghost" disabled={busy} onClick={remove}>
            Excluir
          </button>
        </div>
      </td>
    </tr>
  );
}
