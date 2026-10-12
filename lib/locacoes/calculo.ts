import type { LocacaoUnidade } from "@/lib/types/database.types";
import { hojeNoFuso } from "@/lib/fuso";

export type LocacaoCalculavel = {
  quantidade: number;
  unidade: LocacaoUnidade;
  valorUnitario: number;
  dataInicio: string;
  horasUtilizadas: number;
  dataDevolucao: string | null;
};

export type CustoLocacao = {
  /** Dias corridos de locação, do início até a devolução (ou até hoje). Sempre inclusivo. */
  dias: number;
  /** Unidades cobradas: os dias, ou as horas informadas. */
  unidadesCobradas: number;
  valor: number;
  emUso: boolean;
};

const MS_POR_DIA = 86_400_000;

/** Hoje em ISO no fuso local — o dia de calendário do usuário, não o UTC. */
/**
 * A data de hoje. Delega para o fuso da obra — ver `lib/fuso`.
 *
 * O nome fica: dezenas de chamadas dependem dele, e o que mudou foi de onde
 * a data vem, não o que ela significa.
 */
export function hojeIso(): string {
  return hojeNoFuso();
}

function diasCorridos(inicioIso: string, fimIso: string): number {
  const inicio = new Date(`${inicioIso}T00:00:00Z`).getTime();
  const fim = new Date(`${fimIso}T00:00:00Z`).getTime();
  return Math.floor((fim - inicio) / MS_POR_DIA) + 1;
}

/**
 * Custo acumulado de uma locação. Enquanto o equipamento não é devolvido a
 * conta corre até hoje; a devolução congela tudo na data informada.
 *
 * Por dia:  quantidade × valor × dias corridos (o dia de início e o de
 *           devolução contam — locador cobra a diária dos dois).
 * Por hora: quantidade × valor × horas informadas pelo engenheiro. Os dias
 *           continuam sendo calculados, mas só como informação de quanto tempo
 *           o equipamento ficou na obra — não entram no valor.
 */
export function calcularCustoLocacao(
  locacao: LocacaoCalculavel,
  referenciaIso: string = hojeIso()
): CustoLocacao {
  const emUso = !locacao.dataDevolucao;
  const fim = locacao.dataDevolucao ?? referenciaIso;

  // Locação lançada com início no futuro ainda não acumulou nada.
  const dias = Math.max(0, diasCorridos(locacao.dataInicio, fim));

  const unidadesCobradas = locacao.unidade === "dia" ? dias : locacao.horasUtilizadas;
  const valor = locacao.quantidade * locacao.valorUnitario * unidadesCobradas;

  return { dias, unidadesCobradas, valor, emUso };
}

export function totalLocacoes(
  locacoes: LocacaoCalculavel[],
  referenciaIso: string = hojeIso()
): { total: number; emUso: number; devolvidas: number } {
  let total = 0;
  let emUso = 0;
  let devolvidas = 0;
  for (const locacao of locacoes) {
    const custo = calcularCustoLocacao(locacao, referenciaIso);
    total += custo.valor;
    if (custo.emUso) emUso += 1;
    else devolvidas += 1;
  }
  return { total, emUso, devolvidas };
}
