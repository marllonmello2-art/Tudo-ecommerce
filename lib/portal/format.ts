/** Formatação de datas em português para o portal. */

const DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

const TIME_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

const SHORT_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  timeZone: "America/Sao_Paulo",
});

function parse(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "11 de setembro de 2026". */
export function formatDate(value: string | null | undefined): string {
  const date = parse(value);
  return date ? DATE_FORMAT.format(date) : "";
}

/** "11 de setembro de 2026 às 07:13". */
export function formatDateTime(value: string | null | undefined): string {
  const date = parse(value);
  return date ? `${DATE_FORMAT.format(date)} às ${TIME_FORMAT.format(date)}` : "";
}

/** "11/09/26 07:13" — usado nas tabelas do painel. */
export function formatShort(value: string | null | undefined): string {
  const date = parse(value);
  return date ? `${SHORT_FORMAT.format(date)} ${TIME_FORMAT.format(date)}` : "—";
}

/** Data por extenso do topo do site: "quinta-feira, 11 de setembro de 2026". */
export function formatToday(now = new Date()): string {
  const text = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(now);
  // Só a primeira letra em maiúscula: "Sexta-feira, 11 de setembro de 2026".
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Valor para <input type="datetime-local">. */
export function toLocalInput(value: string | null | undefined): string {
  const date = parse(value);
  if (!date) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
