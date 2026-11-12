import type { NomeDeIcone } from "@/components/layout/nav-icones";
import type { NavEntry } from "@/components/layout/app-shell";

/**
 * As telas que vivem dentro de uma obra.
 *
 * Fonte única: a barra lateral monta os links daqui, o seletor de obra troca o
 * `obraId` mantendo a seção, e a tela de escolha da obra lê o rótulo daqui.
 * Três lugares que precisam concordar sobre o mesmo conjunto — e que divergiam
 * na primeira vez que alguém renomeasse uma seção em só um deles.
 *
 * A ORDEM comunica a área: primeiro o que se planeja, depois o que se registra
 * em campo, depois o que se compra, por fim o que se paga.
 *
 * O que tem `grupo` sai da lista solta e vai para um cartão que abre e fecha —
 * hoje só RH. Seções do mesmo grupo precisam ser vizinhas aqui; ver
 * `entradasDaObra`, que é quem monta.
 */
export type SecaoObra = {
  /** Identificador na URL da tela de escolha de obra. */
  slug: string;
  /** Segmento real da rota sob /obras/<id>. Vazio é a visão geral. */
  segmento: string;
  label: string;
  icone: NomeDeIcone;
  /**
   * Nome do cartão que encaixota esta seção na lateral, quando ela não fica
   * solta. As seções do mesmo grupo têm de ser VIZINHAS nesta lista: o cartão
   * nasce na posição da primeira e recolhe as seguintes.
   */
  grupo?: GrupoDeSecoes;
};

/** Os cartões que agrupam seções na lateral. O ícone é o do cartão fechado. */
export const GRUPOS_DE_SECOES = {
  rh: { label: "RH", icone: "rh" as NomeDeIcone },
} as const;

export type GrupoDeSecoes = keyof typeof GRUPOS_DE_SECOES;

export const SECOES_OBRA: SecaoObra[] = [
  { slug: "visao-geral", segmento: "", label: "Visão geral", icone: "visaoGeral" },

  // Planejamento
  // O slug ("planejamento") é o endereço da tela de escolha de obra e o
  // segmento é a rota real — mexer neles quebraria links salvos sem ganho.
  // Só o rótulo muda.
  { slug: "planejamento", segmento: "orcamento", label: "Financeiro/Orçamento", icone: "planejamento" },
  { slug: "cronograma", segmento: "cronograma", label: "Cronograma", icone: "cronograma" },

  // Execução em campo
  { slug: "diario", segmento: "diario", label: "Diário", icone: "diario" },
  { slug: "avanco", segmento: "avanco", label: "Avanço", icone: "avanco" },

  // Suprimentos
  // Cotações vem ANTES de ordens de compra porque é a ordem em que acontecem:
  // pede-se preço, compara-se, e só então existe uma ordem.
  { slug: "cotacoes", segmento: "cotacoes", label: "Cotações", icone: "cotacoes" },
  { slug: "compras", segmento: "compras", label: "Ordens de Compra", icone: "compras" },
  { slug: "locacoes", segmento: "locacoes", label: "Locações", icone: "locacoes" },

  // Equipe e folha — as três num cartão "RH". Eram linhas soltas, e com onze
  // seções a coluna virou uma lista em que nada se destaca. Folgas veio de
  // cima (estava junto do cronograma, por ser planejamento) porque o cartão
  // exige vizinhança, e ela pertence ao mesmo assunto das outras duas.
  { slug: "folgas", segmento: "folgas", label: "Folgas", icone: "folgas", grupo: "rh" },
  { slug: "presencas", segmento: "presencas", label: "Presenças", icone: "presencas", grupo: "rh" },
  {
    slug: "fechamentos",
    segmento: "fechamentos",
    label: "Fechamentos",
    icone: "fechamentos",
    grupo: "rh",
  },
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

/**
 * As seções da obra como entradas de menu, com os grupos já encaixotados.
 *
 * Existe porque a lateral e a gaveta montavam o menu com um `map` sobre
 * `SECOES_OBRA`, e `map` não sabe agrupar: um cartão "RH" exige transformar
 * três itens da lista em UM, na posição do primeiro. Fazer isso nos dois
 * layouts seria a mesma dobra escrita duas vezes.
 *
 * Varre em ordem e troca a sequência de seções do mesmo grupo por um
 * `NavGroup`. Quem não tem grupo passa direto, como antes.
 *
 * O `prefixo` é o que distingue os dois lados: `/obras` no engenheiro,
 * `/portal/obras` no cliente. O href final ainda é montado no cliente, que é
 * quem sabe em que obra a pessoa está — ver `resolverHref`.
 */
export function entradasDaObra(
  secoes: SecaoObra[] = SECOES_OBRA,
  prefixo?: string
): NavEntry[] {
  const item = (secao: SecaoObra) => ({
    label: secao.label,
    icone: secao.icone,
    obraSecao: { slug: secao.slug, segmento: secao.segmento, ...(prefixo ? { prefixo } : {}) },
  });

  const entradas: NavEntry[] = [];

  for (let i = 0; i < secoes.length; i += 1) {
    const secao = secoes[i];
    if (!secao.grupo) {
      entradas.push(item(secao));
      continue;
    }

    // Engole as vizinhas do mesmo grupo numa passada só.
    const grupo = secao.grupo;
    const doGrupo: SecaoObra[] = [];
    while (i < secoes.length && secoes[i].grupo === grupo) {
      doGrupo.push(secoes[i]);
      i += 1;
    }
    i -= 1; // o `for` incrementa de novo

    entradas.push({
      label: GRUPOS_DE_SECOES[grupo].label,
      icone: GRUPOS_DE_SECOES[grupo].icone,
      items: doGrupo.map(item),
    });
  }

  return entradas;
}
