import { describe, expect, it } from "vitest";
import { ratearEmParcelasIguais } from "./rateio";

const soma = (r: Record<number, string>) =>
  Math.round(Object.values(r).reduce((s, v) => s + Number(v), 0) * 100);

describe("ratearEmParcelasIguais", () => {
  it("divide exato quando o total é divisível", () => {
    expect(ratearEmParcelasIguais([1, 2], 100)).toEqual({ 1: "50.00", 2: "50.00" });
  });

  it("joga o centavo que sobra na última parcela", () => {
    expect(ratearEmParcelasIguais([1, 2, 3], 100)).toEqual({
      1: "33.33",
      2: "33.33",
      3: "33.34",
    });
  });

  /*
   * O motivo de a função existir: a ação recusa a ordem quando a soma das
   * parcelas se afasta mais de um centavo do total. Dividir em ponto flutuante
   * e arredondar cada parcela devolveria 99,99 em três de 100 — e o usuário
   * veria "a soma das parcelas precisa bater com o total" sobre números que
   * ele não digitou.
   */
  it("fecha o total em qualquer número de parcelas", () => {
    for (const total of [100, 0.03, 1000.01, 317.775, 1, 99.99, 12345.67]) {
      for (const n of [1, 2, 3, 6, 7, 12]) {
        const ids = Array.from({ length: n }, (_, i) => i + 1);
        expect(soma(ratearEmParcelasIguais(ids, total))).toBe(Math.round(total * 100));
      }
    }
  });

  it("devolve vazio sem linha nenhuma", () => {
    expect(ratearEmParcelasIguais([], 500)).toEqual({});
  });

  it("usa o id da linha como chave, não a posição", () => {
    expect(ratearEmParcelasIguais([7, 42], 10)).toEqual({ 7: "5.00", 42: "5.00" });
  });

  it("não quebra com total zero", () => {
    expect(ratearEmParcelasIguais([1, 2], 0)).toEqual({ 1: "0.00", 2: "0.00" });
  });
});
