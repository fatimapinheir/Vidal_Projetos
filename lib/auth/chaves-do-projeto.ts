import type { JWK } from "@supabase/supabase-js";

/**
 * A chave pública do projeto, guardada no processo e não no cliente.
 *
 * `getClaims()` verifica o token localmente, mas precisa da chave — e ele a
 * guarda em cache DENTRO da instância do cliente Supabase. Como o proxy e cada
 * página criam uma instância nova por requisição, esse cache nascia vazio toda
 * vez e a biblioteca ia buscar o JWKS. Trocamos uma ida à rede (`getUser`) por
 * outra (o JWKS), e o registro do servidor continuou marcando de 38ms a 947ms
 * no proxy, sem explicação aparente.
 *
 * Aqui o cache vive no MÓDULO, que em Node é compartilhado por todas as
 * requisições do mesmo processo. Primeira requisição do processo busca; as
 * seguintes verificam o token sem sair da máquina.
 *
 * Dez minutos de validade porque a chave de assinatura pode ser rotacionada.
 * Falhando a busca, devolve o que tiver em cache — e, não tendo nada, devolve
 * vazio: aí `getClaims()` cai sozinho no `getUser()` pela rede. Degradar para o
 * caminho lento é melhor que recusar uma sessão legítima.
 */
const VALIDADE_MS = 10 * 60 * 1000;

let cache: { keys: JWK[]; buscadoEm: number } | null = null;

export async function chavesDoProjeto(): Promise<{ keys: JWK[] } | undefined> {
  if (cache && Date.now() - cache.buscadoEm < VALIDADE_MS) return { keys: cache.keys };

  try {
    const resposta = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
      {
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" },
        // Cache nosso, não o do Next: o proxy roda fora do alcance dele.
        cache: "no-store",
      }
    );
    if (!resposta.ok) return cache ? { keys: cache.keys } : undefined;

    const dados = (await resposta.json()) as { keys?: JWK[] };
    if (!dados.keys?.length) return cache ? { keys: cache.keys } : undefined;

    cache = { keys: dados.keys, buscadoEm: Date.now() };
    return { keys: cache.keys };
  } catch {
    return cache ? { keys: cache.keys } : undefined;
  }
}
