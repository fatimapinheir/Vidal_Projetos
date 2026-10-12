import type { NomeDeIcone } from "@/components/layout/nav-icones";

/**
 * As telas que vivem dentro de uma obra.
 *
 * Fonte única: a barra lateral monta os links daqui, o seletor de obra troca o
 * `obraId` mantendo a seção, e a tela de escolha da obra lê o rótulo daqui.
 * Três lugares que precisam concordar sobre o mesmo conjunto — e que divergiam
 * na primeira vez que alguém renomeasse uma seção em só um deles.
 *
 * A ORDEM é o agrupamento. Como os itens ficam soltos na lateral (sem cartão
 * que os encaixote), é a sequência que comunica a área: primeiro o que se
 * planeja, depois o que se registra em campo, depois o que se compra, por fim
 * o que se paga.
 */
export type SecaoObra = {
  /** Identificador na URL da tela de escolha de obra. */
  slug: string;
  /** Segmento real da rota sob /obras/<id>. Vazio é a visão geral. */
  segmento: string;
  label: string;
  icone: NomeDeIcone;
};

export const SECOES_OBRA: SecaoObra[] = [
  { slug: "visao-geral", segmento: "", label: "Visão geral", icone: "visaoGeral" },

  // Planejamento
  // O slug ("planejamento") é o endereço da tela de escolha de obra e o
  // segmento é a rota real — mexer neles quebraria links salvos sem ganho.
  // Só o rótulo muda.
  { slug: "planejamento", segmento: "orcamento", label: "Financeiro/Orçamento", icone: "planejamento" },
  { slug: "cronograma", segmento: "cronograma", label: "Cronograma", icone: "cronograma" },
  { slug: "folgas", segmento: "folgas", label: "Folgas", icone: "folgas" },

  // Execução em campo
  { slug: "diario", segmento: "diario", label: "Diário", icone: "diario" },
  { slug: "avanco", segmento: "avanco", label: "Avanço", icone: "avanco" },

  // Suprimentos
  { slug: "compras", segmento: "compras", label: "Ordens de Compra", icone: "compras" },
  { slug: "locacoes", segmento: "locacoes", label: "Locações", icone: "locacoes" },

  // Equipe e folha
  { slug: "presencas", segmento: "presencas", label: "Presenças", icone: "presencas" },
  { slug: "fechamentos", segmento: "fechamentos", label: "Fechamentos", icone: "fechamentos" },
];

export function caminhoDaSecao(obraId: string, secao: SecaoObra) {
  return secao.segmento ? `/obras/${obraId}/${secao.segmento}` : `/obras/${obraId}`;
}

export function acharSecaoPorSlug(slug: string) {
  return SECOES_OBRA.find((s) => s.slug === slug);
}

/**
 * Descobre em que seção está uma URL de obra.
 *
 * Casa pelo segmento mais longo porque telas internas (/compras/<id>,
 * /diario/<data>) precisam continuar apontando para a seção que as contém.
 */
export function secaoDoCaminho(pathname: string): SecaoObra | undefined {
  const resto = pathname.match(/^\/obras\/[^/]+(?:\/(.*))?$/)?.[1] ?? "";
  return [...SECOES_OBRA]
    .filter((s) => (s.segmento === "" ? resto === "" : resto === s.segmento || resto.startsWith(`${s.segmento}/`)))
    .sort((a, b) => b.segmento.length - a.segmento.length)[0];
}
