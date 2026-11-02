import { describe, expect, it } from "vitest";
import {
  totalLiquidoDoItem,
  subtotalDosItens,
  aplicarDescontoDaNota,
  rotuloDesconto,
} from "./total-item";
import itensReais from "./__fixtures__/itens-reais.json";
import comprasReais from "./__fixtures__/compras-reais.json";

type ItemReal = {
  quantidade: number;
  preco_unitario: number;
  desconto_tipo: "valor" | "percentual" | null;
  desconto_valor: number | null;
  /** Coluna GERADA pelo Postgres — a resposta certa, por definição. */
  total_liquido: number;
};

type CompraReal = {
  desconto_tipo: "valor" | "percentual" | null;
  desconto_valor: number | null;
  subtotal: number;
  valor_total: number;
};

/*
 * O banco é a autoridade, e o teste prova que o TypeScript concorda com ele.
 *
 * `compra_itens.total_liquido` é coluna gerada (`generated always as ... stored`,
 * migração 0011) e `compras.valor_total` sai do gatilho
 * `recalcular_valor_compra`. A conta em TypeScript existe para a tela somar
 * antes de salvar — e divergir dela em silêncio é como a tela passa a mostrar
 * um número que o banco desmente.
 *
 * Por isso o teste roda sobre os valores REAIS de produção, exportados em
 * `__fixtures__`: cada linha traz as entradas e o resultado que o Postgres
 * calculou. Não é um caso inventado por quem escreveu a função.
 */
describe("a conta do item concorda com o Postgres", () => {
  const itens = itensReais as ItemReal[];

  it("tem fixture para testar", () => {
    expect(itens.length).toBeGreaterThan(90);
  });

  it.each(itens.map((item, i) => [i, item] as const))(
    "linha %i bate com total_liquido do banco",
    (_i, item) => {
      // Duas casas: o banco guarda numeric(14,2) e arredonda ao gravar.
      expect(totalLiquidoDoItem(item)).toBeCloseTo(item.total_liquido, 2);
    }
  );

  it("a soma dos itens bate com a soma que o banco guardou", () => {
    const naConta = subtotalDosItens(itens);
    const noBanco = itens.reduce((soma, i) => soma + i.total_liquido, 0);
    expect(naConta).toBeCloseTo(noBanco, 2);
  });
});

describe("o desconto da nota concorda com o gatilho", () => {
  const compras = comprasReais as CompraReal[];

  it.each(compras.map((c, i) => [i, c] as const))(
    "compra %i bate com valor_total do banco",
    (_i, compra) => {
      const calculado = aplicarDescontoDaNota(
        compra.subtotal,
        compra.desconto_tipo,
        compra.desconto_valor
      );
      expect(calculado).toBeCloseTo(compra.valor_total, 2);
    }
  );
});

describe("regras da conta", () => {
  it("sem desconto, é quantidade × preço", () => {
    expect(totalLiquidoDoItem({ quantidade: 10, preco_unitario: 18 })).toBe(180);
  });

  it("desconto percentual abate a porcentagem", () => {
    expect(
      totalLiquidoDoItem({
        quantidade: 10,
        preco_unitario: 18,
        desconto_tipo: "percentual",
        desconto_valor: 10,
      })
    ).toBeCloseTo(162, 2);
  });

  it("desconto em valor abate reais", () => {
    expect(
      totalLiquidoDoItem({
        quantidade: 10,
        preco_unitario: 18,
        desconto_tipo: "valor",
        desconto_valor: 30,
      })
    ).toBeCloseTo(150, 2);
  });

  /*
   * O `greatest(..., 0)` do SQL, que virou `Math.max(..., 0)`.
   *
   * Desconto maior que o item dá ZERO, não negativo. Sem isso, um desconto
   * digitado errado viraria crédito: a linha entraria somando contra o total da
   * nota, e a ordem fecharia por menos do que as parcelas.
   */
  it("desconto maior que o item dá zero, nunca negativo", () => {
    expect(
      totalLiquidoDoItem({
        quantidade: 1,
        preco_unitario: 50,
        desconto_tipo: "valor",
        desconto_valor: 80,
      })
    ).toBe(0);
    expect(
      totalLiquidoDoItem({
        quantidade: 1,
        preco_unitario: 50,
        desconto_tipo: "percentual",
        desconto_valor: 150,
      })
    ).toBe(0);
  });

  it("desconto nulo é tratado como ausente, não como NaN", () => {
    expect(
      totalLiquidoDoItem({
        quantidade: 2,
        preco_unitario: 10,
        desconto_tipo: "valor",
        desconto_valor: null,
      })
    ).toBe(20);
  });

  it("lista vazia soma zero", () => {
    expect(subtotalDosItens([])).toBe(0);
  });
});

describe("rótulo do desconto", () => {
  it("devolve null sem desconto, para a tela mostrar o travessão", () => {
    expect(rotuloDesconto(null, null)).toBeNull();
  });

  it("percentual sai com %", () => {
    expect(rotuloDesconto("percentual", 10)).toBe("10%");
  });

  it("valor sai em reais", () => {
    expect(rotuloDesconto("valor", 50)).toContain("50,00");
  });
});
