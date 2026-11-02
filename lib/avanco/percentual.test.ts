import { describe, expect, it } from "vitest";
import { percentualDeAvanco } from "./percentual";

/*
 * A regra mudou por causa de um caso real, e o teste guarda esse caso.
 *
 * Na etapa "4.0 — Alvenaria e vedações", três das quatro tarefas estavam em
 * 100% e a tela mostrava 60%: o percentual era ponderado por duração, e a
 * única pendente era a mais longa (6 dos 15 dias). A conta estava certa e a
 * leitura, não.
 */
describe("média simples das tarefas", () => {
  it("três de quatro concluídas dá 75%, não 60%", () => {
    expect(percentualDeAvanco([100, 100, 0, 100])).toBe(75);
  });

  it("a duração não entra na conta — tarefa curta pesa igual à longa", () => {
    // Era aqui que a régua antiga dava outro número: com 2, 5, 6 e 2 dias,
    // a ponderação devolvia 60.
    expect(percentualDeAvanco([100, 100, 0, 100])).toBe(75);
  });

  it("avanço parcial conta pela metade, não como zero", () => {
    // Média dos percentuais, e não contagem de concluídas: o engenheiro digita
    // percentual todo dia, e isso precisa aparecer antes de a tarefa fechar.
    expect(percentualDeAvanco([100, 50])).toBe(75);
    expect(percentualDeAvanco([50])).toBe(50);
  });

  it("tudo concluído é 100", () => {
    expect(percentualDeAvanco([100, 100, 100])).toBe(100);
  });

  it("nada começado é 0", () => {
    expect(percentualDeAvanco([0, 0, 0])).toBe(0);
  });

  it("lista vazia é 0, e não divisão por zero", () => {
    expect(percentualDeAvanco([])).toBe(0);
  });

  it("uma tarefa só devolve o percentual dela", () => {
    expect(percentualDeAvanco([37])).toBe(37);
  });
});
