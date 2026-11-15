/**
 * Datas no fuso local do aparelho, no formato das seeds ('2026-10-08' e
 * '2026-10-08 09:30'). `toISOString()` usa UTC: depois das 21h em Brasília
 * a OS ficava com a data do dia seguinte.
 */

const pad = (n: number): string => String(n).padStart(2, '0');

/** Data local no formato AAAA-MM-DD. */
export function todayDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Data e hora locais no formato AAAA-MM-DD HH:mm. */
export function nowTimestamp(d: Date = new Date()): string {
  return `${todayDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Data local daqui a `days` dias (calendário, não 24h corridas). */
export function addDays(days: number, d: Date = new Date()): string {
  return todayDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
}
