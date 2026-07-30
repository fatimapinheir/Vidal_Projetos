/**
 * Formata uma data (coluna `date` do Postgres, ex: "2026-07-20") como dd/mm/aaaa.
 * Não usa `new Date(string)` porque isso interpreta a string como UTC e desloca
 * o dia exibido para trás em fusos horários negativos (ex: America/Sao_Paulo).
 */
export function formatDateBR(value: string | null | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}
