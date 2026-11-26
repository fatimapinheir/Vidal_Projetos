"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { ehAcaoPermissao } from "@/lib/auth/acoes-permissao";

export type PermissaoState = { error: string | null };

/**
 * Concede ou revoga uma permissão.
 *
 * Quem autoriza é a RPC `definir_permissao`, que confere no banco se quem
 * chama é administrador. O `requireRole` aqui é só roteamento — sem a checagem
 * no banco, bastaria um token antigo de administrador para passar.
 *
 * As mensagens de erro vêm do Postgres já em português, escritas na 0082 para
 * serem mostradas ao usuário ("Você não pode retirar a sua própria
 * administração", "O sistema precisa de pelo menos um administrador").
 */
export async function definirPermissaoAction(
  usuarioId: string,
  acao: string,
  conceder: boolean
): Promise<PermissaoState> {
  await requireRole("engenheiro");

  // O tipo não acompanha o que chega do navegador: valida contra o catálogo.
  if (!ehAcaoPermissao(acao)) {
    return { error: "Permissão desconhecida." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("definir_permissao", {
    p_usuario: usuarioId,
    p_acao: acao,
    p_conceder: conceder,
  });

  if (error) return { error: error.message };

  revalidatePath("/permissoes");
  return { error: null };
}

/**
 * Promove ou rebaixa um administrador.
 *
 * As travas (não tirar a própria, nunca deixar zero) estão na RPC e não aqui,
 * de propósito: na camada de ação elas seriam contornáveis por quem chamasse a
 * API direto, e a segunda delas precisa contar as linhas da tabela de qualquer
 * forma.
 */
export async function definirAdministradorAction(
  usuarioId: string,
  admin: boolean
): Promise<PermissaoState> {
  await requireRole("engenheiro");

  const supabase = await createClient();
  const { error } = await supabase.rpc("definir_administrador", {
    p_usuario: usuarioId,
    p_admin: admin,
  });

  if (error) return { error: error.message };

  revalidatePath("/permissoes");
  return { error: null };
}
