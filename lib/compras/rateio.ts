/**
 * Divide um total em parcelas iguais, jogando os centavos de arredondamento na
 * última.
 *
 * Em centavos inteiros, e não dividindo o número com vírgula: `100 / 3` em
 * ponto flutuante dá três parcelas de 33,33 que somam 99,99, e a ação recusa a
 * ordem porque a soma das parcelas não bate com o total. Com o resto na última,
 * a soma fecha por construção — que é exatamente o que a conferência do
 * servidor cobra.
 *
 * A chave do resultado é o id local da linha, não a posição: o formulário
 * remove parcela do meio, e por posição os valores escorregariam para a linha
 * vizinha.
 *
 * Vive aqui, e não dentro do formulário, porque a ordem de compra e a proposta
 * de cotação rateiam igual — e duas cópias divergiriam no primeiro ajuste.
 */
export function ratearEmParcelasIguais(ids: number[], total: number): Record<number, string> {
  const n = ids.length;
  if (!n) return {};

  const centavosTotal = Math.round(total * 100);
  const base = Math.floor(centavosTotal / n);
  const resto = centavosTotal - base * n;

  const resultado: Record<number, string> = {};
  ids.forEach((id, i) => {
    const centavos = base + (i === n - 1 ? resto : 0);
    resultado[id] = (centavos / 100).toFixed(2);
  });
  return resultado;
}
