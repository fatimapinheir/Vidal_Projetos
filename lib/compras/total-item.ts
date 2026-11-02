import type { DescontoTipo } from "@/lib/types/database.types";

/**
 * A conta de total de item e de desconto, num lugar só.
 *
 * Estava escrita em quatro arquivos TypeScript — `compras.ts`,
 * `lancamentos.ts`, `ordem-compra-form.tsx`, `lancamento-form.tsx` — com quatro
 * nomes diferentes para a mesma fórmula, e uma quinta vez em SQL. Cinco cópias
 * de uma regra de dinheiro é onde o erro nasce: basta uma delas não receber a
 * correção que as outras receberam para a tela mostrar um número e o banco
 * gravar outro.
 *
 * A AUTORIDADE CONTINUA SENDO O BANCO. `compra_itens.total_liquido` é coluna
 * gerada (`generated always as ... stored`, migração 0011) e
 * `compras.valor_total` sai do gatilho `recalcular_valor_compra`. O que está
 * aqui é a mesma conta do lado do TypeScript, para a tela poder somar antes de
 * salvar e para a ação conferir o que recebeu — nunca para substituir o que o
 * banco grava.
 *
 * Por isso a fórmula é cópia fiel do SQL, inclusive no `greatest(..., 0)`, que
 * virou `Math.max(..., 0)`: desconto maior que o item dá zero, não negativo.
 */
export type ItemComDesconto = {
  quantidade: number;
  preco_unitario: number;
  desconto_tipo?: DescontoTipo | null;
  desconto_valor?: number | null;
};

/**
 * Arredonda para centavo do mesmo jeito que o Postgres.
 *
 * `compra_itens.total_liquido` é `numeric(14,2)`: o banco arredonda ao gravar.
 * `preco_unitario` é `numeric(14,4)`, então o produto pode ter mais casas — sem
 * arredondar aqui, o TypeScript discorda do banco a partir da terceira.
 *
 * O `toPrecision` no meio não é adorno. `Math.round(valor * 100)` erra quando o
 * valor cai exatamente em meio centavo, e erra por causa de como o JavaScript
 * guarda número:
 *
 *     5 × 66,90 com 5% de desconto = 317,775   (decimal exato)
 *     317.775 * 100                = 31777.499999999996   (binário)
 *     Math.round(...)              = 31777  ->  R$ 317,77
 *     o Postgres (numeric, decimal exato)  ->  R$ 317,78
 *
 * Um centavo de diferença entre a tela e o banco, na mesma linha. Esse caso é
 * REAL: é o item 74 dos 98 que existem em produção, e foi o teste desta função
 * que o encontrou. Com desconto de 5% a situação se repete com frequência.
 *
 * `toPrecision(12)` absorve o erro de representação (que é da ordem de 1e-12
 * relativo) antes do arredondamento, e 12 dígitos significativos cobrem com
 * folga qualquer valor de obra — dez bilhões de reais em centavos tem 12.
 */
function emCentavos(valor: number): number {
  return Math.round(Number((valor * 100).toPrecision(12))) / 100;
}

/** Quantidade × preço, antes de qualquer desconto. */
export function subtotalDoItem(item: ItemComDesconto): number {
  return emCentavos(item.quantidade * item.preco_unitario);
}

/**
 * Total do item com o desconto individual aplicado.
 *
 * Espelha `compra_itens.total_liquido` (0011):
 *
 *   percentual -> greatest(qtd * preco * (1 - desconto/100), 0)
 *   valor      -> greatest(qtd * preco - desconto, 0)
 *   sem        -> qtd * preco
 */
export function totalLiquidoDoItem(item: ItemComDesconto): number {
  // Sem passar por `subtotalDoItem`: o banco arredonda UMA vez, no resultado
  // final da expressão. Arredondar o subtotal e depois o total arredondaria
  // duas vezes, e as duas contas voltariam a divergir.
  const bruto = item.quantidade * item.preco_unitario;
  const desconto = item.desconto_valor ?? 0;

  if (item.desconto_tipo === "percentual") {
    return emCentavos(Math.max(bruto * (1 - desconto / 100), 0));
  }
  if (item.desconto_tipo === "valor") return emCentavos(Math.max(bruto - desconto, 0));
  return emCentavos(bruto);
}

/** Soma dos itens, cada um já líquido do desconto individual. */
export function subtotalDosItens(itens: ItemComDesconto[]): number {
  return itens.reduce((soma, item) => soma + totalLiquidoDoItem(item), 0);
}

/**
 * Desconto da NOTA, aplicado por cima da soma dos itens.
 *
 * É outro desconto, e não o mesmo: o do item abate aquela linha, o da nota
 * abate o total negociado com o fornecedor. Espelha `recalcular_valor_compra`.
 */
export function aplicarDescontoDaNota(
  subtotal: number,
  tipo: DescontoTipo | null | undefined,
  valor: number | null | undefined
): number {
  const desconto = valor ?? 0;
  if (tipo === "percentual") return Math.max(subtotal * (1 - desconto / 100), 0);
  if (tipo === "valor") return Math.max(subtotal - desconto, 0);
  return subtotal;
}

/**
 * Como o desconto se escreve na tela: "10%" ou "R$ 50,00".
 *
 * Vive aqui junto da conta porque é a mesma informação lida de outro jeito —
 * estava duplicado entre a tela de detalhe e o formulário da ordem.
 */
export function rotuloDesconto(
  tipo: DescontoTipo | null | undefined,
  valor: number | null | undefined
): string | null {
  if (!tipo) return null;
  if (tipo === "percentual") return `${valor ?? 0}%`;
  return (valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
