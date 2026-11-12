import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, UserRole } from "@/lib/types/database.types";

type Client = SupabaseClient<Database>;

export type PapeisDoUsuario = {
  /** Os perfis que esta pessoa pode assumir. Nunca vazio. */
  papeis: UserRole[];
  /** Obra em que o perfil de engenheiro abre. Nula = Dashboard. */
  obraPadraoId: string | null;
};

/**
 * Quais perfis a pessoa logada pode assumir — e isto vem do BANCO, não do token.
 *
 * `getSessao` lê o papel ATIVO do JWT justamente para não pagar uma ida de
 * 431 ms ao banco em toda navegação. `papeis` não está no token, e colocá-lo lá
 * criaria uma segunda cópia para sair de sincronia: quem concede o papel é o
 * engenheiro, por SQL, e o metadata do usuário não acompanharia.
 *
 * A ida ao banco é de graça na prática porque esta consulta entra no
 * `Promise.all` que os layouts já fazem (logo da empresa, lista de obras):
 * roda em paralelo com o que já estava lá, e o tempo de parede não muda.
 *
 * Devolve `null` sem sessão ou com perfil ausente — quem chama desenha a
 * moldura sem o seletor, que é o certo para quem tem um perfil só.
 */
export async function papeisDoUsuario(
  supabase: Client,
  usuarioId: string
): Promise<PapeisDoUsuario | null> {
  const { data } = await supabase
    .from("profiles")
    .select("papeis, obra_padrao_id")
    .eq("id", usuarioId)
    .maybeSingle();

  if (!data) return null;

  return {
    // A restrição `profiles_papeis_nao_vazio` garante o conteúdo; o `?? []` é
    // para o caso de o PostgREST devolver nulo por algum motivo nosso.
    papeis: data.papeis ?? [],
    obraPadraoId: data.obra_padrao_id,
  };
}

/**
 * Para onde alguém vai ao entrar num perfil.
 *
 * O engenheiro entra numa OBRA, não num painel. O Dashboard saiu do menu, e
 * continuar mandando a entrada para lá deixava a pessoa numa tela sem caminho
 * de volta — nenhum item do menu aponta para ela.
 *
 * Três tentativas, em ordem de quanto cada uma sabe sobre a intenção:
 *
 *   1. **Obra padrão**, quando definida. É escolha explícita, e ganha de tudo.
 *   2. **Última obra aberta**, do cookie que a barra lateral já usa para saber
 *      para onde apontar. Cobre quem nunca definiu padrão — que é o caso de
 *      quem tem um perfil só e por isso nunca foi perguntado.
 *   3. **A tela de escolher obra**, que já existe para as seções e lista as
 *      obras com endereço e status. É a resposta honesta para "não sei em qual
 *      você quer entrar" — melhor que um painel que o menu não alcança.
 *
 * O cliente segue no `/portal/dashboard` quando não tem padrão: com uma obra
 * só, aquela tela já redireciona direto para ela; com mais de uma, escolher é
 * exatamente o que ela existe para fazer.
 */
export function destinoDoPerfil(
  role: UserRole,
  obraPadraoId: string | null,
  /** Última obra aberta (`lerObraAtiva`), quando não há padrão definida. */
  obraLembradaId: string | null = null
): string {
  if (role === "cliente") {
    return obraPadraoId ? `/portal/obras/${obraPadraoId}` : "/portal/dashboard";
  }

  const obra = obraPadraoId ?? obraLembradaId;
  return obra ? `/obras/${obra}` : "/selecionar-obra/visao-geral";
}

/**
 * Quem pode ser responsável técnico de uma obra.
 *
 * Filtra por `papeis`, e não por `role`: quem tem os dois perfis continua
 * elegível enquanto estiver navegando como cliente. O perfil ATIVO diz o que a
 * pessoa está fazendo agora; o que ela PODE ser é o que importa para aparecer
 * na lista — senão o responsável técnico sumiria do formulário no dia em que
 * ele resolvesse olhar a obra pelo portal.
 *
 * A mesma regra é conferida no banco pelo gatilho
 * `trg_obras_responsavel_tecnico` (0081) — aqui é conveniência de tela.
 */
export async function engenheirosDisponiveis(
  supabase: Client
): Promise<{ id: string; nome: string }[]> {
  const { data } = await supabase
    .from("profiles")
    .select("id, nome")
    .contains("papeis", ["engenheiro"])
    .order("nome");

  return data ?? [];
}
