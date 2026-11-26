import { describe, expect, it } from "vitest";
import { ehMesIso, faixaDeMeses, mesVizinho } from "./meses-do-calendario";

describe("mesVizinho", () => {
  it("anda para frente e para trás dentro do ano", () => {
    expect(mesVizinho("2026-05", 1)).toBe("2026-06");
    expect(mesVizinho("2026-05", -1)).toBe("2026-04");
  });

  /*
   * A virada de ano é o caso que a aritmética ingênua erra: `mes - 1` em
   * janeiro dá zero, e `padStart` produziria "2026-00".
   */
  it("vira o ano nas duas direções", () => {
    expect(mesVizinho("2026-01", -1)).toBe("2025-12");
    expect(mesVizinho("2026-12", 1)).toBe("2027-01");
  });

  it("preserva o zero à esquerda", () => {
    expect(mesVizinho("2026-10", -1)).toBe("2026-09");
  });
});

describe("ehMesIso", () => {
  it("aceita só YYYY-MM", () => {
    expect(ehMesIso("2026-11")).toBe(true);
    expect(ehMesIso("2026-11-26")).toBe(false);
    expect(ehMesIso("2026-1")).toBe(false);
    expect(ehMesIso("")).toBe(false);
    expect(ehMesIso(undefined)).toBe(false);
  });
});

describe("faixaDeMeses", () => {
  const hoje = "2026-11-26";

  it("sem mês na URL, abre no mês de hoje", () => {
    expect(faixaDeMeses({ datas: [], hoje }).mesAtual).toBe("2026-11");
  });

  it("mês inválido na URL cai no mês de hoje em vez de quebrar", () => {
    expect(faixaDeMeses({ datas: [], hoje, mes: "banana" }).mesAtual).toBe("2026-11");
  });

  /*
   * O motivo de a função procurar a menor data em vez de usar a última do
   * array: a versão anterior fazia `todos.at(-1)`, que só funcionava porque o
   * `select` vinha com `order('data', desc)`. Trocar a ordenação da consulta
   * quebraria o limite de navegação sem nenhum sinal.
   */
  it("acha o mês mais antigo independente da ordem das datas", () => {
    const desordenado = { datas: ["2026-11-02", "2026-08-15", "2026-10-01"], hoje };
    expect(faixaDeMeses({ ...desordenado, mes: "2026-09" }).anterior).toBe("2026-08");
  });

  it("não deixa navegar antes do primeiro registro", () => {
    const f = faixaDeMeses({ datas: ["2026-10-05"], hoje, mes: "2026-10" });
    expect(f.anterior).toBeNull();
    expect(f.proximo).toBe("2026-11");
  });

  it("não deixa navegar depois do mês corrente", () => {
    const f = faixaDeMeses({ datas: ["2026-10-05"], hoje, mes: "2026-11" });
    expect(f.proximo).toBeNull();
    expect(f.anterior).toBe("2026-10");
  });

  /*
   * O limite para frente é o mês de HOJE e não o do último registro: se a obra
   * passar dez dias sem RDO, o engenheiro ainda precisa alcançar o mês
   * corrente para abrir a folha de hoje.
   */
  it("alcança o mês corrente mesmo sem registro nele", () => {
    const f = faixaDeMeses({ datas: ["2026-09-30"], hoje, mes: "2026-10" });
    expect(f.proximo).toBe("2026-11");
  });

  it("obra sem nenhum registro não navega para lado nenhum", () => {
    const f = faixaDeMeses({ datas: [], hoje });
    expect(f.anterior).toBeNull();
    expect(f.proximo).toBeNull();
  });
});
