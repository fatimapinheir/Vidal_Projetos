/**
 * Paginação de listagem, do lado do servidor.
 *
 * Do servidor, e não do cliente, por dois motivos — um de conforto e um de
 * correção:
 *
 * - Conforto: a tela não precisa carregar trezentas linhas para mostrar vinte.
 * - Correção: o PostgREST do Supabase devolve no máximo 1000 linhas por
 *   consulta, EM SILÊNCIO. Uma listagem que passe disso simplesmente perde o
 *   resto, sem erro, sem aviso e sem nada na tela dizendo que faltou. Paginar
 *   é o que garante que a listagem continue completa quando a obra crescer.
 *
 * A página vive na URL, não em estado de componente: assim o voltar do
 * navegador funciona, o link é compartilhável, e a tela segue sendo servidor.
 */

export const POR_PAGINA_PADRAO = 25;

/** Lê o número da página de um searchParam, tolerando lixo. */
export function lerPagina(valor: string | string[] | undefined): number {
  const bruto = Array.isArray(valor) ? valor[0] : valor;
  const n = Number(bruto);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function totalDePaginas(total: number, porPagina = POR_PAGINA_PADRAO): number {
  return Math.max(1, Math.ceil(total / porPagina));
}

/**
 * O intervalo para o `.range()` do Supabase, já encaixado no total.
 *
 * Página além do fim volta para a última em vez de devolver vazio: é o que
 * acontece quando alguém apaga registros com a página 7 aberta, e uma tela em
 * branco ali parece bug, não fim da lista.
 */
export function faixaDaPagina(
  pagina: number,
  total: number,
  porPagina = POR_PAGINA_PADRAO
): { pagina: number; de: number; ate: number } {
  const ultima = totalDePaginas(total, porPagina);
  const atual = Math.min(Math.max(pagina, 1), ultima);
  const de = (atual - 1) * porPagina;
  return { pagina: atual, de, ate: de + porPagina - 1 };
}
