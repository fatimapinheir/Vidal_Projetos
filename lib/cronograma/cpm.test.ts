import { describe, expect, it } from "vitest";
import { calcularCPM, contarDiasUteis } from "./cpm";

const tarefa = (id: string, duracaoDias: number, ancora?: string) => ({
  id,
  nome: id,
  duracaoDias,
  restricaoInicioNaoAntesDe: ancora ?? null,
  dataInicioReal: null,
  dataFimReal: null,
});

const liga = (predecessoraId: string, sucessoraId: string) => ({
  predecessoraId,
  sucessoraId,
  tipo: "termino_inicio" as const,
  lagDias: 0,
});

/*
 * O motor do cronograma. As duas regras que mais custam se erradas são a semana
 * de cinco dias e o pulo de folga: uma tarefa de 5 dias começada na quinta
 * terminava na segunda, atravessando sábado e domingo como dias de obra.
 */
describe("a semana é de segunda a sexta", () => {
  it("tarefa de 1 dia na quinta termina na quinta", () => {
    // 2026-01-08 é quinta.
    const [r] = calcularCPM([tarefa("a", 1, "2026-01-08")], []);
    expect(r.dataInicioCedo).toBe("2026-01-08");
    expect(r.dataFimCedo).toBe("2026-01-08");
  });

  it("tarefa de 5 dias na quinta atravessa o fim de semana", () => {
    const [r] = calcularCPM([tarefa("a", 5, "2026-01-08")], []);
    // qui 08, sex 09, (sáb/dom fora), seg 12, ter 13, qua 14
    expect(r.dataFimCedo).toBe("2026-01-14");
  });

  it("início caindo no sábado escorrega para a segunda", () => {
    // 2026-01-10 é sábado.
    const [r] = calcularCPM([tarefa("a", 1, "2026-01-10")], []);
    expect(r.dataInicioCedo).toBe("2026-01-12");
  });
});

describe("folgas cadastradas não contam como dia útil", () => {
  it("um feriado no meio empurra o fim", () => {
    const [r] = calcularCPM(
      [tarefa("a", 3, "2026-01-08")],
      [],
      [{ dataInicio: "2026-01-09", dataFim: "2026-01-09" }]
    );
    // qui 08, (sex 09 é folga), seg 12, ter 13
    expect(r.dataFimCedo).toBe("2026-01-13");
  });
});

describe("encadeamento", () => {
  it("a sucessora começa no dia útil seguinte ao fim da predecessora", () => {
    const r = calcularCPM(
      [tarefa("a", 2, "2026-01-08"), tarefa("b", 1)],
      [liga("a", "b")]
    );
    const b = r.find((t) => t.id === "b")!;
    // a: qui 08 e sex 09; b: seg 12
    expect(b.dataInicioCedo).toBe("2026-01-12");
  });

  it("espera a predecessora que termina por último", () => {
    const r = calcularCPM(
      [tarefa("a", 1, "2026-01-08"), tarefa("b", 5, "2026-01-08"), tarefa("c", 1)],
      [liga("a", "c"), liga("b", "c")]
    );
    const [b, c] = [r.find((t) => t.id === "b")!, r.find((t) => t.id === "c")!];
    expect(c.dataInicioCedo > b.dataFimCedo).toBe(true);
  });
});

describe("folga (margem)", () => {
  it("a corrente mais longa tem folga zero; o ramo curto tem sobra", () => {
    const r = calcularCPM(
      [tarefa("a", 1, "2026-01-05"), tarefa("longa", 5), tarefa("curta", 1), tarefa("fim", 1)],
      [liga("a", "longa"), liga("a", "curta"), liga("longa", "fim"), liga("curta", "fim")]
    );
    expect(r.find((t) => t.id === "longa")!.folgaDias).toBe(0);
    expect(r.find((t) => t.id === "curta")!.folgaDias).toBe(4);
  });

  /*
   * A criticidade NÃO sai mais daqui — ver a migração 0065. O motor devolve
   * datas e folga; quem marca tarefa crítica é o engenheiro.
   */
  it("o resultado não traz criticidade", () => {
    const [r] = calcularCPM([tarefa("a", 1, "2026-01-08")], []);
    expect("critica" in r).toBe(false);
  });
});

/*
 * O caso que travou a CASA VIDAL ALPHA, reduzido ao essencial.
 *
 * Numa obra em andamento, as datas REAIS lançadas nem sempre respeitam a
 * ordem das dependências: lá, 35 tarefas foram concluídas entre 12/10 e
 * 02/11, independentemente de onde estavam na corrente. Quando uma sucessora
 * termina antes da predecessora, a passagem para trás precisa de datas ANTES
 * do início da janela — e o cálculo inteiro parava, com uma mensagem dizendo
 * que o cronograma tinha ficado GRANDE demais.
 *
 * Nenhuma edição em nenhuma tarefa daquela obra salvava.
 */
describe("datas reais que contradizem a ordem das dependências", () => {
  const comReal = (id: string, duracaoDias: number, inicio: string, fim: string) => ({
    id,
    nome: id,
    duracaoDias,
    restricaoInicioNaoAntesDe: null,
    dataInicioReal: inicio,
    dataFimReal: fim,
  });

  it("calcula em vez de estourar, e acusa a inconsistência como folga negativa", () => {
    const r = calcularCPM(
      [
        { ...tarefa("inicio", 1, "2026-01-05") },
        // "a" termina DEPOIS de "b", que depende dela. É a contradição.
        comReal("a", 5, "2026-02-02", "2026-02-20"),
        comReal("b", 5, "2026-01-12", "2026-01-16"),
        tarefa("c", 30),
      ],
      [liga("inicio", "a"), liga("a", "b"), liga("b", "c")]
    );

    expect(r).toHaveLength(4);
    // Todas as datas existem: o cálculo não parou.
    for (const t of r) {
      expect(t.dataInicioTarde).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(t.dataFimTarde).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    // E a contradição aparece onde deve: "a" não cabe no lugar que ocupa.
    expect(r.find((t) => t.id === "a")!.folgaDias).toBeLessThan(0);
  });

  it("duração absurda falha rápido, e com a frase do lado certo", () => {
    /*
     * Também é teste de DESEMPENHO, por isso o número é grande mas finito: a
     * janela é um array montado dia a dia, e sem o teto de margem isto
     * congelaria a tela em vez de reclamar.
     */
    const antes = Date.now();
    expect(() => calcularCPM([tarefa("gigante", 200_000, "2026-01-05")], [])).toThrow(
      /horizonte/
    );
    expect(Date.now() - antes).toBeLessThan(2000);
  });
});

describe("o que o motor recusa", () => {
  it("tarefa sem predecessora e sem âncora, com o nome no erro", () => {
    expect(() => calcularCPM([tarefa("a", 1, "2026-01-08"), tarefa("solta", 1)], [])).toThrow(
      /solta/
    );
  });

  it("ciclo nas dependências", () => {
    expect(() =>
      calcularCPM([tarefa("a", 1, "2026-01-08"), tarefa("b", 1)], [liga("a", "b"), liga("b", "a")])
    ).toThrow(/ciclo/i);
  });

  it("lista vazia devolve lista vazia, sem erro", () => {
    expect(calcularCPM([], [])).toEqual([]);
  });
});

describe("contarDiasUteis", () => {
  it("conta inclusivo nas duas pontas, pulando o fim de semana", () => {
    // qui 08 a seg 12 = 08, 09, 12
    expect(contarDiasUteis("2026-01-08", "2026-01-12", [])).toBe(3);
  });

  it("desconta folga cadastrada", () => {
    expect(contarDiasUteis("2026-01-08", "2026-01-12", [
      { dataInicio: "2026-01-09", dataFim: "2026-01-09" },
    ])).toBe(2);
  });

  it("fim antes do início é zero", () => {
    expect(contarDiasUteis("2026-01-12", "2026-01-08", [])).toBe(0);
  });

  it("um sábado sozinho é zero dia útil", () => {
    expect(contarDiasUteis("2026-01-10", "2026-01-11", [])).toBe(0);
  });
});
