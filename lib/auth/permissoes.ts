import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";
import { createClient } from "@/lib/supabase/server";
import type { AcaoPermissao } from "@/lib/auth/acoes-permissao";

export type { AcaoPermissao };

type Supabase = SupabaseClient<Database>;

/**
 * Pergunta ao banco se quem está logado pode a ação.
 *
 * Vai ao banco de propósito, e isso é o oposto do que `requireRole` faz. O
 * `requireRole` lê o token porque roda em TODA navegação, e o comentário dele
 * avisa que aquilo é roteamento, não autorização. Aqui é clique raro — aprovar
 * uma compra, excluir uma obra — então uma ida ao banco (hoje ~50ms, com as
 * funções em São Paulo) é barata, e a leitura ao vivo é o que importa:
 * `auth.updateUser` não emite token novo na hora, então um portão baseado em
 * token manteria uma permissão revogada válida por quase uma hora.
 */
export async function pode(acao: AcaoPermissao, cliente?: Supabase): Promise<boolean> {
  const supabase = cliente ?? (await createClient());
  const { data, error } = await supabase.rpc("pode", { p_acao: acao });
  // Na dúvida, nega. Erro de rede não deve virar permissão.
  if (error) return false;
  return data === true;
}

/**
 * Para usar no topo de uma Server Action: devolve a mensagem de erro quando a
 * permissão falta, e `null` quando está tudo certo.
 *
 *   const negado = await exigirPermissao("obra.excluir");
 *   if (negado) return { error: negado };
 *
 * Devolve mensagem em vez de redirecionar porque estas ações rodam dentro de
 * formulários que já sabem exibir `{ error }` — um `redirect()` no meio de um
 * `useActionState` jogaria a pessoa fora da tela sem dizer por quê.
 */
export async function exigirPermissao(
  acao: AcaoPermissao,
  cliente?: Supabase
): Promise<string | null> {
  if (await pode(acao, cliente)) return null;
  return "Você não tem permissão para isso. Fale com quem administra o sistema.";
}

/**
 * Todas as permissões de quem está logado, de uma vez.
 *
 * A tela que precisa esconder cinco botões não deve fazer cinco idas ao banco.
 * Administrador volta com o catálogo inteiro, porque é o que `pode` responderia
 * para ele ação por ação — a tela não precisa saber da regra.
 */
export async function minhasPermissoes(cliente?: Supabase): Promise<Set<AcaoPermissao>> {
  const supabase = cliente ?? (await createClient());

  const [{ data: admin }, { data: proprias }] = await Promise.all([
    supabase.rpc("is_admin"),
    supabase.from("permissoes_usuario").select("acao"),
  ]);

  if (admin === true) {
    const { data: catalogo } = await supabase.from("permissoes_catalogo").select("acao");
    return new Set((catalogo ?? []).map((c) => c.acao as AcaoPermissao));
  }

  return new Set((proprias ?? []).map((p) => p.acao as AcaoPermissao));
}

/**
 * Para as ações que ENGENHEIRO E CLIENTE podem fazer.
 *
 * Aprovar ordem de compra, escolher proposta de cotação e excluir lançamento
 * não são exclusivas do engenheiro: a RPC `aprovar_compra` aceita
 * `cliente_tem_acesso_obra(obra) or is_engenheiro()`, e isso é o fluxo
 * desejado — o cliente aprova a compra da obra dele.
 *
 * O catálogo de permissões governa ENGENHEIROS. O cliente é governado por
 * `cliente_tem_acesso_obra`, que é outro eixo e já funciona. Sem esta
 * distinção, gatear `aprovarCompraAction` com `pode()` quebraria a aprovação
 * do cliente: `pode` exige `role = 'engenheiro'` e devolveria `false` para ele.
 *
 * EFEITO COLATERAL CONHECIDO: quem tem perfil duplo (hoje Ardiles e Fátima)
 * pode aprovar pelo lado do cliente numa obra em que é cliente, mesmo sem a
 * permissão de engenheiro. Está coerente — ali ele age como cliente da obra,
 * e a permissão restringe a capacidade de engenheiro, não os direitos de
 * cliente. Mas é bom saber que o caminho existe.
 */
export async function exigirPermissaoSeEngenheiro(
  acao: AcaoPermissao,
  role: string,
  cliente?: Supabase
): Promise<string | null> {
  if (role !== "engenheiro") return null;
  return exigirPermissao(acao, cliente);
}
