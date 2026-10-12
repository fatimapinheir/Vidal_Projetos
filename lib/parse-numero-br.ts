/**
 * Converte para `number` o que vier de célula de planilha. `null` se não der.
 *
 * Aceita número já numérico, formato brasileiro (1.234,56) e americano
 * (1,234.56), com ou sem símbolo de moeda e espaços.
 *
 * A limpeza do símbolo e o caso americano foram acrescentados depois de uma
 * importação real voltar com zero itens: a planilha do engenheiro traz
 * " R$20,000.00 " e "1.00", e a versão anterior devolvia null para os dois —
 * removia o ponto, trocava a vírgula por ponto e sobrava "R$20.00000", que não
 * é número. O orçamento inteiro era descartado por "preço inválido", sem dizer
 * o motivo.
 */
export function parseNumeroBR(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  // Fora moeda, espaço, espaço fino e qualquer outro texto. Sobram dígitos,
  // separadores e o sinal.
  const limpo = value.replace(/[^\d.,-]/g, "").trim();
  if (!limpo || !/\d/.test(limpo)) return null;

  const ultimaVirgula = limpo.lastIndexOf(",");
  const ultimoPonto = limpo.lastIndexOf(".");

  let normalizado: string;

  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    /*
     * Os dois separadores presentes: o ÚLTIMO é o decimal, o outro é milhar.
     * Resolve "1.234,56" (brasileiro) e "1,234.56" (americano) sem precisar
     * saber de onde veio a planilha.
     */
    const decimal = ultimaVirgula > ultimoPonto ? "," : ".";
    const milhar = decimal === "," ? "." : ",";
    normalizado = limpo.split(milhar).join("").replace(decimal, ".");
  } else if (ultimaVirgula >= 0) {
    // Só vírgula: decimal brasileiro. Mais de uma, é milhar ("1,234,567").
    const virgulas = limpo.split(",").length - 1;
    normalizado = virgulas > 1 ? limpo.split(",").join("") : limpo.replace(",", ".");
  } else if (ultimoPonto >= 0) {
    // Só ponto: decimal (americano, e também o que o Excel devolve em "1.00").
    // Mais de um, é milhar ("1.234.567").
    const pontos = limpo.split(".").length - 1;
    normalizado = pontos > 1 ? limpo.split(".").join("") : limpo;
  } else {
    normalizado = limpo;
  }

  const parsed = Number(normalizado);
  return Number.isFinite(parsed) ? parsed : null;
}
