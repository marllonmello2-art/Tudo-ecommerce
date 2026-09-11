"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Encerra a sessão apagando o cookie assinado no servidor. */
export function LogoutButton({ label }: { label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await fetch("/api/admin/session", { method: "DELETE" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void logout();
      }}
      style={{ display: "flex", alignItems: "center", gap: 12 }}
    >
      <span style={{ fontSize: 13, color: "#c9ced7" }}>{label}</span>
      <button type="submit" className="dm-btn dm-btn-ghost" disabled={busy}>
        {busy ? "Saindo…" : "Sair"}
      </button>
    </form>
  );
}
