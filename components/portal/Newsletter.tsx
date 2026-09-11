"use client";

import { useState } from "react";
import { BRAND } from "../../lib/portal/brand";

/** Captura de e-mails da newsletter (salva em `newsletter_subscribers`). */
export function Newsletter() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function subscribe(event: React.FormEvent) {
    event.preventDefault();
    setState("sending");
    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Não foi possível concluir o cadastro.");
      setState("done");
      setMessage("Pronto! Você vai receber o resumo do dia no seu e-mail.");
      setEmail("");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível concluir o cadastro.");
    }
  }

  return (
    <section className="dm-newsletter" aria-labelledby="dm-newsletter-title">
      <h3 id="dm-newsletter-title">Receba o {BRAND.name} no seu e-mail</h3>
      <p>Um resumo das principais notícias do dia, sem custo e sem spam.</p>
      <form onSubmit={subscribe}>
        <input
          type="email"
          name="email"
          required
          value={email}
          placeholder="seu@email.com"
          aria-label="Seu e-mail"
          onChange={(event) => setEmail(event.target.value)}
        />
        <button type="submit" className="dm-btn" disabled={state === "sending"}>
          {state === "sending" ? "Enviando…" : "Quero receber"}
        </button>
      </form>
      {message ? (
        <p className={`dm-note ${state === "error" ? "dm-note-error" : "dm-note-ok"}`}>{message}</p>
      ) : null}
    </section>
  );
}
