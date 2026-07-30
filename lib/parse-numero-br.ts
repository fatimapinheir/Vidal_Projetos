/**
 * Converte um número em formato brasileiro (1.234,56) ou já numérico/US (1234.56)
 * para number. Retorna null se não for um número válido.
 */
export function parseNumeroBR(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const hasComma = trimmed.includes(",");
  const normalized = hasComma
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
