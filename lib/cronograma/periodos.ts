/**
 * Janelas de tempo que a timeline do cronograma enquadra.
 *
 * Fica aqui, fora do componente, porque é aritmética de calendário pura — o
 * tipo de código que erra em silêncio na virada de mês ou de ano e que só um
 * teste pega.
 *
 * Tudo em UTC de propósito: formatar data em hora local num fuso negativo
 * (America/Sao_Paulo) desloca o dia e faz a semana começar no sábado.
 */

export const PERIODOS = [
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mês" },
  { id: "trimestre", label: "Trimestre" },
  { id: "tudo", label: "Obra inteira" },
] as const;

export type PeriodoId = (typeof PERIODOS)[number]["id"];

export type Janela = { inicioIso: string; fimIso: string };

/**
 * O intervalo de cada período, ancorado na data informada.
 *
 * - `semana`: domingo a sábado da semana corrente — a semana do calendário,
 *   não "sete dias a partir de hoje".
 * - `mes`: o mês corrente inteiro, do dia 1 ao último.
 * - `trimestre`: o mês corrente mais dois à frente, que é o horizonte de
 *   compra e contratação.
 * - `tudo`: sem janela; quem chama mostra a obra inteira.
 */
export function janelaDoPeriodo(periodo: PeriodoId, hojeIso: string): Janela | null {
  if (periodo === "tudo") return null;

  const hoje = new Date(`${hojeIso}T00:00:00Z`);

  if (periodo === "semana") {
    const domingo = new Date(hoje);
    domingo.setUTCDate(domingo.getUTCDate() - domingo.getUTCDay());
    const sabado = new Date(domingo);
    sabado.setUTCDate(sabado.getUTCDate() + 6);
    return {
      inicioIso: domingo.toISOString().slice(0, 10),
      fimIso: sabado.toISOString().slice(0, 10),
    };
  }

  const mesesAFrente = periodo === "trimestre" ? 2 : 0;
  const primeiro = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
  // Dia 0 do mês seguinte ao último é o último dia do último mês da janela —
  // resolve 28/29/30/31 sem tabela de meses.
  const ultimo = new Date(
    Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + mesesAFrente + 1, 0)
  );

  return {
    inicioIso: primeiro.toISOString().slice(0, 10),
    fimIso: ultimo.toISOString().slice(0, 10),
  };
}

/**
 * Encaixa a janela onde há tarefa.
 *
 * O período sai do calendário — "a semana corrente", "o mês corrente" — e numa
 * obra que começa em março ou que já terminou isso aponta para um trecho vazio
 * da timeline: o engenheiro clica em "Semana" e vê um quadro em branco.
 *
 * Havendo tarefa dentro da janela, ela fica como está. Não havendo, a janela
 * desliza até a tarefa mais próxima, mantendo a MESMA largura — semana
 * continua com sete dias, trimestre com três meses.
 *
 * `alinharNoDomingo` devolve a semana ao calendário depois do deslize: sem
 * isso ela começaria no dia em que a tarefa começa, e deixaria de ser a
 * semana de domingo a sábado que o período promete.
 */
export function encaixarNosDados(
  janela: { inicio: number; fim: number } | null,
  barras: { inicio: number; fim: number }[],
  alinharNoDomingo = false
): { inicio: number; fim: number } | null {
  if (!janela || !barras.length) return janela;

  const temDado = barras.some((b) => b.inicio <= janela.fim && b.fim >= janela.inicio);
  if (temDado) return janela;

  const largura = janela.fim - janela.inicio;
  const primeiro = Math.min(...barras.map((b) => b.inicio));
  const ultimo = Math.max(...barras.map((b) => b.fim));

  /*
   * Para onde deslizar depende de onde a janela caiu.
   *
   * Depois de tudo (obra encerrada): encosta o FIM da janela no fim da obra,
   * mostrando o trecho final. Escolher "a tarefa mais próxima" aqui faria a
   * janela pousar na última tarefa e cortar as anteriores, que é justamente o
   * que se quer ver.
   *
   * Antes de tudo (obra ainda por começar): encosta o início no começo.
   *
   * No meio, num vão entre frentes: vai para a tarefa mais próxima, que é a
   * leitura natural de "o que tem por perto".
   */
  let inicio: number;
  if (janela.inicio > ultimo) {
    inicio = ultimo - largura;
  } else if (janela.fim < primeiro) {
    inicio = primeiro;
  } else {
    const maisProxima = barras.reduce((melhor, barra) =>
      Math.abs(barra.inicio - janela.inicio) < Math.abs(melhor.inicio - janela.inicio)
        ? barra
        : melhor
    );
    inicio = maisProxima.inicio;
  }
  if (alinharNoDomingo) {
    // `paraDia` conta dias desde 1970-01-01, que foi uma quinta-feira; +4
    // leva a contagem para um domingo antes de tirar o resto.
    inicio -= (inicio + 4) % 7;
  }

  return { inicio, fim: inicio + largura };
}
