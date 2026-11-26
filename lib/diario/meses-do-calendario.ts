/**
 * Navegação por mês do calendário do diário.
 *
 * Vivia dentro da página do portal. Saiu para cá quando a mesma visão passou a
 * existir no lado do engenheiro: duas cópias da aritmética de mês divergiriam
 * na primeira correção, e o limite de "até onde dá para navegar" é regra, não
 * detalhe de tela.
 */

const MES_ISO = /^\d{4}-\d{2}$/;

/** "YYYY-MM" bem formado. Só isso — não verifica se o mês existe na obra. */
export function ehMesIso(valor: string | undefined | null): boolean {
  return MES_ISO.test(valor ?? "");
}

/**
 * Mês vizinho, sem passar por `Date`.
 *
 * Aritmética de ISO de propósito: `new Date("2026-01-01")` em fuso negativo
 * cai em dezembro, e o calendário passaria a abrir no mês errado para quem
 * está no Brasil — exatamente o caso desta obra.
 */
export function mesVizinho(mes: string, passo: number): string {
  const [ano, m] = mes.split("-").map(Number);
  const total = ano * 12 + (m - 1) + passo;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export type FaixaDeMeses = {
  /** O mês a desenhar. */
  mesAtual: string;
  /** Mês anterior navegável, ou `null` quando já é o mais antigo com registro. */
  anterior: string | null;
  /** Próximo mês navegável, ou `null` quando já é o mês corrente. */
  proximo: string | null;
};

/**
 * Qual mês mostrar e até onde dá para navegar.
 *
 * Para trás, o mês do registro mais antigo; para frente, o mês corrente. Sem
 * esses limites clica-se a vida inteira em meses vazios, sem nada indicando
 * que não há mais nada ali.
 *
 * `datas` em qualquer ordem: a função procura a menor em vez de confiar na
 * ordenação da consulta. A versão anterior usava `todos.at(-1)`, que dependia
 * de o `select` vir com `order('data', desc)` — acoplamento invisível que
 * quebraria em silêncio se alguém trocasse a ordenação.
 */
export function faixaDeMeses({
  datas,
  hoje,
  mes,
}: {
  /** Datas "YYYY-MM-DD" com registro, em qualquer ordem. */
  datas: string[];
  /** Hoje, "YYYY-MM-DD", já no fuso da obra. */
  hoje: string;
  /** O que veio na URL. Inválido ou ausente cai no mês de hoje. */
  mes?: string;
}): FaixaDeMeses {
  const mesDeHoje = hoje.slice(0, 7);
  const mesAtual = ehMesIso(mes) ? mes! : mesDeHoje;

  const meses = datas.map((d) => d.slice(0, 7));
  const primeiroMes = meses.length ? meses.reduce((a, b) => (a < b ? a : b)) : mesDeHoje;

  return {
    mesAtual,
    anterior: mesAtual > primeiroMes ? mesVizinho(mesAtual, -1) : null,
    /*
     * O limite para frente é o mês de HOJE, não o do último registro: o
     * engenheiro abre folha de hoje o tempo todo, e travar no último registro
     * esconderia o mês corrente sempre que a obra passasse uns dias sem RDO.
     */
    proximo: mesAtual < mesDeHoje ? mesVizinho(mesAtual, 1) : null,
  };
}
