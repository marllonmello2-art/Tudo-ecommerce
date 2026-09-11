"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BRAND } from "../../lib/portal/brand";

/**
 * Login do painel — e, no primeiro acesso (nenhum admin cadastrado),
 * o formulário de criação do usuário dono do portal.
 */
export function LoginForm({ needsSetup, returnTo }: { needsSetup: boolean; returnTo: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const endpoint = needsSetup ? "/api/admin/setup" : "/api/admin/session";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(needsSetup ? { email, password, name } : { email, password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Não foi possível entrar.");
      router.replace(returnTo);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível entrar.");
      setBusy(false);
    }
  }

  return (
    <div className="dm-login">
      <div className="dm-login-card">
        <div className="dm-logo">
          <span className="dm-logo-mark" aria-hidden="true">
            {BRAND.initials}
          </span>
          <span className="dm-logo-text">
            {BRAND.nameFirst} <em>{BRAND.nameLast}</em>
          </span>
        </div>

        <h1 style={{ fontSize: 20, margin: "18px 0 4px" }}>
          {needsSetup ? "Criar acesso do editor" : "Painel do editor"}
        </h1>
        <p style={{ color: "#6b7280", fontSize: 14, marginTop: 0, marginBottom: 20 }}>
          {needsSetup
            ? "Nenhum usuário cadastrado ainda. Crie o primeiro acesso — esta tela se fecha depois disso."
            : "Entre com seu e-mail e senha para publicar."}
        </p>

        <form onSubmit={submit}>
          {needsSetup ? (
            <div className="dm-field">
              <label htmlFor="dm-name">Seu nome</label>
              <input
                id="dm-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: Marllon Mello"
              />
            </div>
          ) : null}

          <div className="dm-field">
            <label htmlFor="dm-email">E-mail</label>
            <input
              id="dm-email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="dm-field">
            <label htmlFor="dm-password">Senha</label>
            <input
              id="dm-password"
              type="password"
              required
              autoComplete={needsSetup ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {needsSetup ? <small>Mínimo de 10 caracteres.</small> : null}
          </div>

          {error ? <p className="dm-note dm-note-error">{error}</p> : null}

          <button type="submit" className="dm-btn" disabled={busy} style={{ width: "100%", marginTop: 6 }}>
            {busy ? "Aguarde…" : needsSetup ? "Criar acesso" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
