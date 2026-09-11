/** Geração de slugs amigáveis (URLs) a partir de títulos em português. */

/** Remove acentos, pontuação e espaços — "Café da Manhã" -> "cafe-da-manha". */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "sem-titulo";
}

/**
 * Garante unicidade do slug consultando os slugs já existentes.
 * `taken` recebe um slug candidato e responde se ele já está em uso.
 */
export async function uniqueSlug(
  base: string,
  taken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base);
  if (!(await taken(root))) return root;
  for (let suffix = 2; suffix < 200; suffix += 1) {
    const candidate = `${root}-${suffix}`;
    if (!(await taken(candidate))) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}
