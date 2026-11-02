import { describe, expect, it } from "vitest";
import { semNumero, comNumero, numeroDaTarefa } from "./numeracao";

describe("semNumero", () => {
  it("tira o prefixo de um nível", () => {
    expect(semNumero("4.1 Marcação das paredes")).toBe("Marcação das paredes");
  });

  it("tira prefixo de dois dígitos", () => {
    expect(semNumero("16.8 Entrega técnica da obra")).toBe("Entrega técnica da obra");
  });

  it("tira prefixo de mais de um nível", () => {
    expect(semNumero("4.1.2 Subtarefa")).toBe("Subtarefa");
  });

  /*
   * O caso que obriga o ponto na expressão: número solto no começo do nome é
   * parte do nome, não numeração.
   */
  it("NÃO tira número sem ponto — é parte do nome", () => {
    expect(semNumero("2 camadas de impermeabilização")).toBe("2 camadas de impermeabilização");
    expect(semNumero("3 demãos de pintura")).toBe("3 demãos de pintura");
  });

  it("nome sem número nenhum passa inteiro", () => {
    expect(semNumero("Concretagem da laje")).toBe("Concretagem da laje");
  });

  it("apara espaço sobrando", () => {
    expect(semNumero("  4.1   Marcação  ")).toBe("Marcação");
  });
});

describe("comNumero", () => {
  it("põe o número da posição", () => {
    expect(comNumero("Marcação das paredes", 4, 1)).toBe("4.1 Marcação das paredes");
  });

  /*
   * Editar duas vezes não pode empilhar prefixo. É o erro que a função existe
   * para impedir: sem tirar o antigo, viraria "4.1 4.1 Marcação".
   */
  it("substitui o número antigo em vez de empilhar", () => {
    expect(comNumero("4.4 Vergas e contravergas", 4, 3)).toBe("4.3 Vergas e contravergas");
    expect(comNumero(comNumero("Vergas", 4, 4), 4, 3)).toBe("4.3 Vergas");
  });

  it("renumera quando a etapa muda de posição", () => {
    expect(comNumero("4.1 Marcação", 3, 1)).toBe("3.1 Marcação");
  });

  it("o caso do pedido: apagar a 3.3 faz a 3.4 virar 3.3", () => {
    expect(comNumero("3.4 Elevação das paredes", 3, 3)).toBe("3.3 Elevação das paredes");
  });
});

describe("numeroDaTarefa", () => {
  it("devolve só o número", () => {
    expect(numeroDaTarefa("4.1 Marcação")).toBe("4.1");
    expect(numeroDaTarefa("16.8 Entrega")).toBe("16.8");
  });

  it("devolve null quando não há número", () => {
    expect(numeroDaTarefa("Concretagem")).toBeNull();
    expect(numeroDaTarefa("2 camadas")).toBeNull();
  });
});
