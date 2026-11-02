import { describe, expect, it } from "vitest";
import { UNIDADES, normalizarUnidade, rotuloUnidade } from "./unidades";

/*
 * A unidade virou lista fechada porque o campo livre produziu 14 grafias para
 * sete unidades nos dados reais — "un" e "UN", "m²", "M2" e "m2", "m³", "M3" e
 * "m3". Não é estética: a busca de composição na SINAPI casa unidade por
 * igualdade EXATA, então "m²" nunca encontrava o item medido em "M2".
 */
describe("normalizarUnidade junta as grafias da mesma unidade", () => {
  it.each([
    ["un", "UN"],
    ["UN", "UN"],
    ["Un", "UN"],
    ["unid", "UN"],
    ["unidade", "UN"],
    [" un ", "UN"],
  ])('"%s" vira %s', (bruta, esperada) => {
    expect(normalizarUnidade(bruta)).toBe(esperada);
  });

  it.each([
    ["m²", "M2"],
    ["M2", "M2"],
    ["m2", "M2"],
    ["metro quadrado", "M2"],
  ])('"%s" vira M2', (bruta) => {
    expect(normalizarUnidade(bruta)).toBe("M2");
  });

  it.each([
    ["m³", "M3"],
    ["m3", "M3"],
    ["metro cubico", "M3"],
  ])('"%s" vira M3', (bruta) => {
    expect(normalizarUnidade(bruta)).toBe("M3");
  });

  it('"ml" vira M, que é como a obra escreve metro linear', () => {
    expect(normalizarUnidade("ml")).toBe("M");
  });

  it("mês e seus apelidos", () => {
    expect(normalizarUnidade("mes")).toBe("MES");
    expect(normalizarUnidade("meses")).toBe("MES");
    expect(normalizarUnidade("mês")).toBe("MES");
  });

  /*
   * Devolver null, e não um palpite, é a decisão importante: a unidade original
   * é preservada em vez de trocada pela primeira da lista. Trocar em silêncio
   * mudaria o que o engenheiro digitou.
   */
  it("o que não reconhece devolve null, para a original ser preservada", () => {
    expect(normalizarUnidade("M2XMES")).toBeNull();
    expect(normalizarUnidade("carrada")).toBeNull();
    expect(normalizarUnidade("")).toBeNull();
    expect(normalizarUnidade("   ")).toBeNull();
  });

  it("toda unidade da lista normaliza para ela mesma", () => {
    for (const u of UNIDADES) {
      expect(normalizarUnidade(u.valor)).toBe(u.valor);
    }
  });
});

describe("rotuloUnidade", () => {
  it("traduz o código para o rótulo da lista", () => {
    expect(rotuloUnidade("UN")).toContain("unidade");
    expect(rotuloUnidade("M2")).toContain("metro quadrado");
  });

  it("devolve o próprio valor quando não conhece — nunca string vazia", () => {
    expect(rotuloUnidade("M2XMES")).toBe("M2XMES");
  });
});
