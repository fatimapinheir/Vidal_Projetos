import type { LocacaoUnidade } from "@/lib/types/database.types";
import { hojeNoFuso } from "@/lib/fuso";

export type LocacaoCalculavel = {
  quantidade: number;
  unidade: LocacaoUnidade;
  valorUnitario: number;
  dataInicio: string;
  horasUtilizadas: number;
  dataDevolucao: string | null;
  /** Só na cobrança mensal. Sem ela não há mensalidade a vencer. */
  dataPrimeiroVencimento?: string | null;
  /** Só na cobrança mensal. Ausente vale um mês. */
  mesesContratados?: number | null;
};

export type CustoLocacao = {
  /** Dias corridos de locação, do início até a devolução (ou até hoje). Sempre inclusivo. */
  dias: number;
  /** Unidades cobradas: os dias, as horas informadas, ou as mensalidades vencidas. */
  unidadesCobradas: number;
  /**
   * O que JÁ CORREU até a referência.
   *
   * Por dia e por hora é o custo acumulado. Por mês são as mensalidades dos
   * meses que já começaram — um contrato de seis meses assinado ontem acumulou
   * uma, não seis.
   */
  valor: number;
  /**
   * O que o CONTRATO soma por inteiro.
   *
   * Só difere de `valor` na cobrança mensal, onde existe um fim combinado. Por
   * dia e por hora não há contrato fechado — a conta corre enquanto o
   * equipamento estiver na obra —, então os dois são o mesmo número.
   */
  valorContratado: number;
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

/**
 * Soma meses a uma data ISO, prendendo no último dia do mês curto.
 *
 * 31 de janeiro mais um mês é 28 de fevereiro, e não 3 de março. É o que o
 * Postgres faz, e esta função existe para dar o MESMO resultado que ele: as
 * parcelas da mensalidade são geradas lá (`sincronizar_mensalidades_locacao`),
 * e se a contagem daqui divergisse, a tela diria um número de mensalidades
 * vencidas diferente do que está em contas a pagar.
 */
function somarMeses(iso: string, meses: number): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const alvo = new Date(Date.UTC(ano, mes - 1 + meses, 1));
  const ultimoDia = new Date(
    Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)
  ).getUTCDate();
  alvo.setUTCDate(Math.min(dia, ultimoDia));
  return alvo.toISOString().slice(0, 10);
}

/**
 * Quantas mensalidades já correram até `fimIso`, no máximo as contratadas.
 *
 * Conta pelo MÊS do vencimento, não pelo dia: entrado o mês com o equipamento
 * na obra, a mensalidade dele já é devida. É como o locador cobra — a diária
 * de outubro não passa a existir no dia 16 porque o boleto vence no dia 16; o
 * equipamento esteve lá o mês todo.
 *
 * Comparar pelo dia era a primeira versão, e deixava o acumulado em R$ 0,00
 * durante as duas primeiras semanas de uso de um equipamento que estava na
 * obra desde o dia 1º.
 */
function mensalidadesCorridas(locacao: LocacaoCalculavel, fimIso: string): number {
  if (!locacao.dataPrimeiroVencimento) return 0;
  const contratadas = Math.max(1, locacao.mesesContratados ?? 1);
  const mesLimite = fimIso.slice(0, 7);
  let corridas = 0;
  // Os vencimentos são crescentes: o primeiro mês futuro encerra a contagem.
  while (corridas < contratadas) {
    const vencimento = somarMeses(locacao.dataPrimeiroVencimento, corridas);
    if (vencimento.slice(0, 7) > mesLimite) break;
    corridas += 1;
  }
  return corridas;
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
 * Por mês:  valor × mensalidades JÁ CORRIDAS (a quantidade não multiplica,
 *           ver abaixo) — as dos meses que
 *           já começaram, ver `mensalidadesCorridas` —, e `valorContratado`
 *           traz o contrato inteiro. A primeira versão devolvia zero aqui,
 *           porque o dinheiro do mensal entra no custo da obra pela ordem de
 *           compra e somá-lo de novo contaria duas vezes — mas o efeito na
 *           tela de locações foi "Acumulado em uso: R$ 0,00" ao lado de uma
 *           linha de R$ 1.800,00. O zero pertencia a UM leitor, não à função.
 *           Quem não pode somar o mensal é a visão geral da obra, e agora ela
 *           o exclui no próprio ponto da soma, onde a razão é visível.
 */
export function calcularCustoLocacao(
  locacao: LocacaoCalculavel,
  referenciaIso: string = hojeIso()
): CustoLocacao {
  const emUso = !locacao.dataDevolucao;
  const fim = locacao.dataDevolucao ?? referenciaIso;

  // Locação lançada com início no futuro ainda não acumulou nada.
  const dias = Math.max(0, diasCorridos(locacao.dataInicio, fim));

  if (locacao.unidade === "mes") {
    const corridas = mensalidadesCorridas(locacao, fim);
    /*
     * A quantidade NÃO multiplica no mensal.
     *
     * O formulário tem "Quantidade" e "Valor por mês" lado a lado, e isso me
     * levou a ler o segundo como preço unitário. Não é como a obra contrata: o
     * locador cobra um aluguel pelo CONJUNTO — dez andaimes a R$ 144 custam
     * R$ 144 por mês, não R$ 1.440. A quantidade descreve o que está em obra.
     *
     * Por dia e por hora a multiplicação continua, a pedido: a regra desse
     * caso ainda vai ser definida com a construtora, e a mesma dúvida se
     * aplica a ela.
     */
    const porMes = locacao.valorUnitario;
    return {
      dias,
      unidadesCobradas: corridas,
      valor: porMes * corridas,
      valorContratado: porMes * Math.max(1, locacao.mesesContratados ?? 1),
      emUso,
    };
  }

  const unidadesCobradas = locacao.unidade === "dia" ? dias : locacao.horasUtilizadas;
  const valor = locacao.quantidade * locacao.valorUnitario * unidadesCobradas;

  return { dias, unidadesCobradas, valor, valorContratado: valor, emUso };
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
