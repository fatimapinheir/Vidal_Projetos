/**
 * Traz TODAS as linhas de uma consulta, passando página por página.
 *
 * O PostgREST corta a resposta num teto de linhas — 1000 por padrão — e o faz
 * **sem erro e sem aviso**: a consulta parece ter dado certo e o array só vem
 * menor. Não é um problema de desempenho, é de correção: uma soma feita sobre
 * esse array devolve um número errado com cara de certo.
 *
 * O teto também não é o limite da ferramenta, é uma proteção contra pedir o
 * banco inteiro por engano. Quando a tela precisa mesmo da lista completa — um
 * orçamento de obra tem de 500 a 2000 linhas, e a soma tem de fechar — o jeito
 * certo é pedir em páginas.
 *
 * Recebe uma FÁBRICA de consulta, e não uma consulta: o construtor do
 * supabase-js vira promise ao ser aguardado e não pode ser reaproveitado para a
 * página seguinte.
 *
 *     const itens = await buscarTodasAsLinhas((de, ate) =>
 *       supabase.from("orcamento_itens").select("*").eq("versao_id", id).range(de, ate)
 *     );
 *
 * A paginação precisa de ordem estável para não repetir nem pular linha entre
 * páginas: inclua um `.order()` na consulta, por coluna única de preferência.
 */
export async function buscarTodasAsLinhas<T>(
  consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  opcoes: { porPagina?: number; maximo?: number } = {}
): Promise<{ linhas: T[]; error: unknown }> {
  // 1000 é o teto padrão do PostgREST. Pedir exatamente isso aproveita a página
  // inteira; pedir mais seria cortado para o mesmo número.
  const porPagina = opcoes.porPagina ?? 1000;
  /*
   * Um teto de segurança, porque o laço depende da resposta do servidor para
   * terminar. Sem ele, uma consulta mal filtrada varreria a tabela inteira a
   * 1000 por vez e derrubaria a renderização da página.
   */
  const maximo = opcoes.maximo ?? 20_000;

  const linhas: T[] = [];

  for (let de = 0; de < maximo; de += porPagina) {
    const { data, error } = await consulta(de, de + porPagina - 1);
    if (error) return { linhas, error };

    const pagina = data ?? [];
    linhas.push(...pagina);

    // Página incompleta significa fim: não há motivo para pedir a seguinte.
    if (pagina.length < porPagina) return { linhas, error: null };
  }

  return { linhas, error: null };
}
