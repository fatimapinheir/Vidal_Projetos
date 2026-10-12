import type { DependenciaTipo } from "@/lib/types/database.types";

export type TarefaEntrada = {
  id: string;
  /** Só para a mensagem de erro — o cálculo usa o id. */
  nome?: string;
  duracaoDias: number;
  restricaoInicioNaoAntesDe: string | null;
  dataInicioReal: string | null;
  dataFimReal: string | null;
};

export type DependenciaEntrada = {
  predecessoraId: string;
  sucessoraId: string;
  tipo: DependenciaTipo;
  lagDias: number;
};

export type FolgaEntrada = {
  dataInicio: string;
  dataFim: string;
};

export type TarefaCalculada = {
  id: string;
  dataInicioCedo: string;
  dataFimCedo: string;
  dataInicioTarde: string;
  dataFimTarde: string;
  folgaDias: number;
  critica: boolean;
};

const MS_POR_DIA = 86_400_000;

function paraDia(iso: string): number {
  return Math.floor(new Date(`${iso}T00:00:00Z`).getTime() / MS_POR_DIA);
}

function paraIso(dia: number): string {
  return new Date(dia * MS_POR_DIA).toISOString().slice(0, 10);
}

/**
 * Quantos dias úteis existem entre duas datas, inclusive nas duas pontas.
 *
 * É o inverso do que o CPM faz: ele recebe duração e devolve datas; aqui o
 * engenheiro informa início e fim e a duração é deduzida. Vive neste arquivo,
 * e não na tela, porque precisa pular folga exatamente com o mesmo critério —
 * duas contagens de dia útil divergentes fariam a data que o engenheiro
 * digitou não ser a que o cronograma mostra de volta.
 *
 * Devolve 0 quando o fim é antes do início, e nunca conta um dia de folga.
 */
export function contarDiasUteis(
  inicioIso: string,
  fimIso: string,
  folgas: FolgaEntrada[]
): number {
  const inicio = paraDia(inicioIso);
  const fim = paraDia(fimIso);
  if (fim < inicio) return 0;

  const folgaSet = new Set<number>();
  for (const f of folgas) {
    for (let d = paraDia(f.dataInicio); d <= paraDia(f.dataFim); d++) folgaSet.add(d);
  }

  let uteis = 0;
  for (let d = inicio; d <= fim; d++) if (!folgaSet.has(d)) uteis++;
  return uteis;
}

/**
 * Constrói o mapeamento entre dia de calendário e "dia útil" (índice sequencial
 * que pula os dias marcados como folga). Todo o CPM roda em cima desses índices
 * — como eles são consecutivos por construção, a aritmética de datas (fim =
 * início + duração - 1, etc.) continua válida mesmo com folgas no meio.
 */
function construirCalendarioUtil(folgas: FolgaEntrada[], diaMinimo: number, diaMaximo: number) {
  const folgaSet = new Set<number>();
  for (const f of folgas) {
    const inicio = paraDia(f.dataInicio);
    const fim = paraDia(f.dataFim);
    for (let d = inicio; d <= fim; d++) folgaSet.add(d);
  }

  const calendarioParaIndice = new Map<number, number>();
  const indiceParaCalendario: number[] = [];
  for (let d = diaMinimo; d <= diaMaximo; d++) {
    if (folgaSet.has(d)) continue;
    calendarioParaIndice.set(d, indiceParaCalendario.length);
    indiceParaCalendario.push(d);
  }

  function paraIndice(diaCalendario: number): number {
    let d = diaCalendario;
    // Se a data cair numa folga, usa o próximo dia útil (não dá pra começar/terminar numa folga).
    while (folgaSet.has(d)) d++;
    const indice = calendarioParaIndice.get(d);
    if (indice === undefined) {
      throw new Error("Data fora do intervalo do calendário calculado para o cronograma.");
    }
    return indice;
  }

  function paraDiaCalendario(indice: number): number {
    if (indice < 0 || indice >= indiceParaCalendario.length) {
      throw new Error("O cronograma ficou maior que o horizonte calculado — tente reduzir folgas/durações.");
    }
    return indiceParaCalendario[indice];
  }

  return { paraIndice, paraDiaCalendario };
}

/**
 * Data mínima em que a sucessora pode começar, dado o tipo de dependência e o
 * início/fim já resolvidos (reais, se houver, senão calculados) da predecessora.
 */
function restricaoForward(
  tipo: DependenciaTipo,
  lag: number,
  predInicio: number,
  predFim: number,
  duracaoSucessora: number
): number {
  switch (tipo) {
    case "termino_inicio":
      return predFim + lag + 1;
    case "inicio_inicio":
      return predInicio + lag;
    case "termino_termino":
      return predFim + lag - duracaoSucessora + 1;
    case "inicio_termino":
      return predInicio + lag - duracaoSucessora + 1;
  }
}

/** Data máxima em que a predecessora pode terminar, dado o início/fim "tarde" já resolvidos da sucessora. */
function restricaoBackward(
  tipo: DependenciaTipo,
  lag: number,
  sucInicioTarde: number,
  sucFimTarde: number,
  duracaoPredecessora: number
): number {
  switch (tipo) {
    case "termino_inicio":
      return sucInicioTarde - lag - 1;
    case "inicio_inicio":
      return sucInicioTarde - lag + duracaoPredecessora - 1;
    case "termino_termino":
      return sucFimTarde - lag;
    case "inicio_termino":
      return sucFimTarde - lag + duracaoPredecessora - 1;
  }
}

/** Ordena topologicamente pelo grafo de dependências (Kahn). Lança erro se houver ciclo. */
function ordenarTopologicamente(
  tarefas: TarefaEntrada[],
  dependencias: DependenciaEntrada[]
): string[] {
  const grauEntrada = new Map<string, number>(tarefas.map((t) => [t.id, 0]));
  const sucessoresDe = new Map<string, string[]>(tarefas.map((t) => [t.id, []]));

  for (const dep of dependencias) {
    sucessoresDe.get(dep.predecessoraId)?.push(dep.sucessoraId);
    grauEntrada.set(dep.sucessoraId, (grauEntrada.get(dep.sucessoraId) ?? 0) + 1);
  }

  const fila = tarefas.filter((t) => (grauEntrada.get(t.id) ?? 0) === 0).map((t) => t.id);
  const ordem: string[] = [];

  while (fila.length) {
    const id = fila.shift()!;
    ordem.push(id);
    for (const sucessorId of sucessoresDe.get(id) ?? []) {
      const grau = (grauEntrada.get(sucessorId) ?? 0) - 1;
      grauEntrada.set(sucessorId, grau);
      if (grau === 0) fila.push(sucessorId);
    }
  }

  if (ordem.length !== tarefas.length) {
    throw new Error("As dependências formam um ciclo — não é possível calcular o cronograma.");
  }

  return ordem;
}

/**
 * Calcula o CPM (Critical Path Method) para as tarefas de uma obra.
 * Tarefas sem predecessora precisam de `restricaoInicioNaoAntesDe` (âncora).
 * Quando uma tarefa já tem data real (início e/ou fim), essa data é usada no
 * lugar da calculada para propagar atraso real às sucessoras.
 * `folgas` são dias (ou intervalos) que não contam como dia útil — o início e
 * o fim de qualquer tarefa nunca cai numa folga, e a duração das tarefas é
 * contada em dias úteis, pulando essas datas.
 */
export function calcularCPM(
  tarefas: TarefaEntrada[],
  dependencias: DependenciaEntrada[],
  folgas: FolgaEntrada[] = []
): TarefaCalculada[] {
  if (!tarefas.length) return [];

  const ordem = ordenarTopologicamente(tarefas, dependencias);
  const porId = new Map(tarefas.map((t) => [t.id, t]));

  const datasReferenciadas: number[] = [];
  for (const t of tarefas) {
    if (t.restricaoInicioNaoAntesDe) datasReferenciadas.push(paraDia(t.restricaoInicioNaoAntesDe));
    if (t.dataInicioReal) datasReferenciadas.push(paraDia(t.dataInicioReal));
    if (t.dataFimReal) datasReferenciadas.push(paraDia(t.dataFimReal));
  }
  if (!datasReferenciadas.length) {
    throw new Error("Nenhuma tarefa tem data de início definida — informe uma data âncora.");
  }

  const somaDuracoes = tarefas.reduce((soma, t) => soma + t.duracaoDias, 0);
  const diaMinimo = Math.min(...datasReferenciadas);
  const diaMaximo = diaMinimo + somaDuracoes + 730;

  const { paraIndice, paraDiaCalendario } = construirCalendarioUtil(folgas, diaMinimo, diaMaximo);

  const restricaoPorId = new Map<string, number | null>();
  const inicioRealPorId = new Map<string, number | null>();
  const fimRealPorId = new Map<string, number | null>();
  for (const t of tarefas) {
    restricaoPorId.set(t.id, t.restricaoInicioNaoAntesDe ? paraIndice(paraDia(t.restricaoInicioNaoAntesDe)) : null);
    inicioRealPorId.set(t.id, t.dataInicioReal ? paraIndice(paraDia(t.dataInicioReal)) : null);
    fimRealPorId.set(t.id, t.dataFimReal ? paraIndice(paraDia(t.dataFimReal)) : null);
  }

  const predecessorasDe = new Map<string, DependenciaEntrada[]>(tarefas.map((t) => [t.id, []]));
  const sucessorasDe = new Map<string, DependenciaEntrada[]>(tarefas.map((t) => [t.id, []]));
  for (const dep of dependencias) {
    predecessorasDe.get(dep.sucessoraId)?.push(dep);
    sucessorasDe.get(dep.predecessoraId)?.push(dep);
  }

  const inicioCedo = new Map<string, number>();
  const fimCedo = new Map<string, number>();

  // Forward pass: início/fim mais cedo possíveis (em dias úteis), usando data real quando existir.
  for (const id of ordem) {
    const tarefa = porId.get(id)!;
    const preds = predecessorasDe.get(id) ?? [];

    let inicioMinimo = restricaoPorId.get(id) ?? -Infinity;

    for (const dep of preds) {
      const pred = porId.get(dep.predecessoraId)!;
      const predInicio = inicioRealPorId.get(pred.id) ?? inicioCedo.get(pred.id)!;
      const predFim = fimRealPorId.get(pred.id) ?? fimCedo.get(pred.id)!;
      const restricao = restricaoForward(dep.tipo, dep.lagDias, predInicio, predFim, tarefa.duracaoDias);
      inicioMinimo = Math.max(inicioMinimo, restricao);
    }

    if (!preds.length && inicioMinimo === -Infinity) {
      // Nome em vez do uuid: a mensagem chega ao engenheiro, e um uuid não
      // diz qual tarefa ele precisa consertar.
      throw new Error(
        `A tarefa "${tarefa.nome ?? id}" não tem predecessora nem data de início definida — informe uma data âncora para ela.`
      );
    }

    const inicioReal = inicioRealPorId.get(id) ?? null;
    const inicio = inicioReal ?? inicioMinimo;
    const fimCalculado = inicio + tarefa.duracaoDias - 1;
    const fim = fimRealPorId.get(id) ?? fimCalculado;

    inicioCedo.set(id, inicio);
    fimCedo.set(id, fim);
  }

  const fimDoProjeto = Math.max(...tarefas.map((t) => fimCedo.get(t.id)!));

  const inicioTarde = new Map<string, number>();
  const fimTarde = new Map<string, number>();

  // Backward pass: início/fim mais tarde possíveis sem atrasar o fim do projeto.
  for (let i = ordem.length - 1; i >= 0; i--) {
    const id = ordem[i];
    const tarefa = porId.get(id)!;
    const sucs = sucessorasDe.get(id) ?? [];

    let fimMaximo = sucs.length ? Infinity : fimDoProjeto;

    for (const dep of sucs) {
      const suc = porId.get(dep.sucessoraId)!;
      const sucInicioTarde = inicioTarde.get(suc.id)!;
      const sucFimTarde = fimTarde.get(suc.id)!;
      const restricao = restricaoBackward(dep.tipo, dep.lagDias, sucInicioTarde, sucFimTarde, tarefa.duracaoDias);
      fimMaximo = Math.min(fimMaximo, restricao);
    }

    const inicio = fimMaximo - tarefa.duracaoDias + 1;
    inicioTarde.set(id, inicio);
    fimTarde.set(id, fimMaximo);
  }

  return tarefas.map((t) => {
    const folga = inicioTarde.get(t.id)! - inicioCedo.get(t.id)!;
    return {
      id: t.id,
      dataInicioCedo: paraIso(paraDiaCalendario(inicioCedo.get(t.id)!)),
      dataFimCedo: paraIso(paraDiaCalendario(fimCedo.get(t.id)!)),
      dataInicioTarde: paraIso(paraDiaCalendario(inicioTarde.get(t.id)!)),
      dataFimTarde: paraIso(paraDiaCalendario(fimTarde.get(t.id)!)),
      folgaDias: folga,
      critica: folga <= 0,
    };
  });
}
