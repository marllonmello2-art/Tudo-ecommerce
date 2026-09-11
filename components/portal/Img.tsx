/* eslint-disable @next/next/no-img-element */
/**
 * Wrapper de <img>.
 *
 * As capas das matérias vêm do R2 (servidas por /api/media) ou de URLs
 * externas, então não passam pelo otimizador de imagens do Next — usamos a tag
 * nativa em um único lugar para manter o resto do código limpo.
 */
export function Img({
  src,
  alt,
  className,
  loading = "lazy",
}: {
  src: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  return <img src={src} alt={alt} className={className} loading={loading} decoding="async" />;
}

/** Caixa cinza com as iniciais do portal, quando a matéria não tem capa. */
export function ImgPlaceholder({ label = "DM" }: { label?: string }) {
  return <div className="dm-placeholder">{label}</div>;
}
