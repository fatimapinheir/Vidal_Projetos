/**
 * Unidades de medida do orçamento.
 *
 * Virou lista fechada porque o campo livre produziu 14 grafias para sete
 * unidades nos dados reais: "un" e "UN", "m²", "M2" e "m2", "m³", "M3" e "m3",
 * "m" e "M", "kg" e "KG". Em compras apareceu até uma unidade "30", que é
 * quantidade digitada no campo errado.
 *
 * Isso não é só estética: a busca de composição na SINAPI casa unidade por
 * igualdade exata (`.eq("unidade", ...)`), então "m²" nunca encontra o item
 * medido em "M2".
 *
 * Os códigos são os da própria SINAPI, em maiúsculas — é com eles que a tabela
 * importada compara.
 */
export const UNIDADES = [
  { valor: "UN", label: "UN — unidade" },
  { valor: "VB", label: "VB — verba" },
  { valor: "M", label: "M — metro" },
  { valor: "M2", label: "M² — metro quadrado" },
  { valor: "M3", label: "M³ — metro cúbico" },
  { valor: "KG", label: "KG — quilograma" },
  { valor: "T", label: "T — tonelada" },
  { valor: "L", label: "L — litro" },
  { valor: "SC", label: "SC — saco" },
  { valor: "CJ", label: "CJ — conjunto" },
  { valor: "PAR", label: "PAR — par" },
  { valor: "JG", label: "JG — jogo" },
  { valor: "CENTO", label: "CENTO" },
  { valor: "MIL", label: "MIL" },
  { valor: "MES", label: "MÊS" },
  { valor: "H", label: "H — hora" },
  { valor: "KWH", label: "KWH" },
] as const;

const PADRAO = new Map<string, string>(UNIDADES.map((u) => [u.valor, u.label]));

/**
 * Normaliza a grafia para o código da lista. Devolve null quando não reconhece
 * — e aí a unidade original é preservada, não trocada por um palpite.
 */
export function normalizarUnidade(bruta: string): string | null {
  const limpa = bruta
    .trim()
    .toUpperCase()
    .replace(/²/g, "2")
    .replace(/³/g, "3")
    .replace(/[.\s]/g, "");
  if (!limpa) return null;

  if (PADRAO.has(limpa)) return limpa;

  // Grafias por extenso que aparecem em planilha.
  const apelidos: Record<string, string> = {
    UNID: "UN",
    UNIDADE: "UN",
    METRO: "M",
    ML: "M",
    METROQUADRADO: "M2",
    METROCUBICO: "M3",
    QUILO: "KG",
    QUILOGRAMA: "KG",
    LITRO: "L",
    SACO: "SC",
    VERBA: "VB",
    CONJUNTO: "CJ",
    HORA: "H",
    MESES: "MES",
    MS: "MES",
  };
  return apelidos[limpa] ?? null;
}

export function rotuloUnidade(valor: string): string {
  return PADRAO.get(valor) ?? valor;
}
