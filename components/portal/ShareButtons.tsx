"use client";

import { useState } from "react";

/**
 * Botões de compartilhamento. A URL é montada no cliente (window.location)
 * para funcionar em qualquer domínio onde o portal estiver publicado.
 */
export function ShareButtons({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  const currentUrl = () => (typeof window === "undefined" ? "" : window.location.href);
  const share = (template: (url: string, text: string) => string) => {
    const url = encodeURIComponent(currentUrl());
    const text = encodeURIComponent(title);
    window.open(template(url, text), "_blank", "noopener,noreferrer");
  };

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(currentUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="dm-share">
      <span className="dm-share-label">Compartilhar</span>
      <button type="button" onClick={() => share((url, text) => `https://api.whatsapp.com/send?text=${text}%20${url}`)}>
        WhatsApp
      </button>
      <button type="button" onClick={() => share((url, text) => `https://twitter.com/intent/tweet?url=${url}&text=${text}`)}>
        X
      </button>
      <button type="button" onClick={() => share((url) => `https://www.facebook.com/sharer/sharer.php?u=${url}`)}>
        Facebook
      </button>
      <button type="button" onClick={copyLink}>
        {copied ? "Link copiado ✓" : "Copiar link"}
      </button>
    </div>
  );
}
