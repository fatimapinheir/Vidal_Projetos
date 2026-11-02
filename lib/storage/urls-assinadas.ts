import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Assina vários caminhos do Storage numa requisição só.
 *
 * Os quatro lugares que mostram arquivo — fotos do diário, fotos do RDO, anexos
 * da ordem de compra, comprovantes das parcelas — chamavam `createSignedUrl`
 * (singular) dentro de um laço: uma ida ao Storage por arquivo. Num RDO com dez
 * fotos são dez idas; num `for` sequencial, dez esperas em fila.
 *
 * `createSignedUrls` (plural) faz o mesmo trabalho numa requisição. A diferença
 * aparece no celular, onde a latência é o custo e não a banda.
 *
 * Devolve um Map de caminho para URL. Caminho que o Storage recusar (arquivo
 * apagado, por exemplo) simplesmente não entra no Map — quem chama já trata
 * ausência mostrando "não foi possível carregar", e derrubar a página inteira
 * por causa de uma foto perdida seria pior.
 */
export async function urlsAssinadas(
  // `any` no genérico do cliente: este helper não conhece o schema, e amarrá-lo
  // ao `Database` obrigaria a passar o tipo em cada chamada sem ganho nenhum.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  bucket: string,
  caminhos: string[],
  segundos: number
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  // Sem caminho não há o que pedir — e `createSignedUrls([])` é uma ida à rede
  // para nada.
  if (!caminhos.length) return urls;

  // Repetido não precisa ser assinado duas vezes: a mesma foto pode aparecer em
  // dois lugares da mesma tela.
  const unicos = [...new Set(caminhos)];

  const { data } = await supabase.storage.from(bucket).createSignedUrls(unicos, segundos);

  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) urls.set(item.path, item.signedUrl);
  }

  return urls;
}

/**
 * O mesmo, para arquivos espalhados em buckets diferentes.
 *
 * É o caso dos anexos da ordem de compra: a cotação mora em `cotacoes` e o
 * comprovante em `comprovantes-pagamento`. Agrupa por bucket e faz uma
 * requisição para cada um — duas, em vez de uma por arquivo.
 *
 * A chave do Map é `bucket + "/" + caminho`, porque o mesmo caminho pode existir
 * em dois buckets.
 */
export async function urlsAssinadasPorBucket(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  arquivos: { bucket: string; path: string }[],
  segundos: number
): Promise<Map<string, string>> {
  const porBucket = new Map<string, string[]>();
  for (const a of arquivos) {
    porBucket.set(a.bucket, [...(porBucket.get(a.bucket) ?? []), a.path]);
  }

  const resultado = new Map<string, string>();

  await Promise.all(
    [...porBucket.entries()].map(async ([bucket, caminhos]) => {
      const urls = await urlsAssinadas(supabase, bucket, caminhos, segundos);
      for (const [caminho, url] of urls) resultado.set(`${bucket}/${caminho}`, url);
    })
  );

  return resultado;
}
