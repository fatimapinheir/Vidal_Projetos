import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

/**
 * A URL da logo da empresa, para o topo do menu.
 *
 * Busca o perfil do ENGENHEIRO, não o de quem está olhando: é a marca de quem
 * opera a obra, e é ela que o cliente precisa ver no portal dele.
 *
 * Lida com a sessão de quem chama, sem chave de serviço — o bucket é público
 * (0051) e o nome do engenheiro não é segredo. A assinatura do RDO precisa do
 * rodeio administrativo porque é documento em bucket privado; a logo não.
 *
 * A RLS esconde `profiles` de outro usuário do cliente, então a consulta volta
 * vazia para ele — por isso o caminho sai de uma função com `security definer`
 * em vez de um select direto.
 */
export async function buscarLogoEmpresa(
  supabase: SupabaseClient<Database>
): Promise<{ url: string | null; nome: string | null }> {
  const { data } = await supabase.rpc("logo_da_empresa");
  const linha = Array.isArray(data) ? data[0] : data;

  if (!linha?.logo_path) return { url: null, nome: linha?.nome ?? null };

  const { data: publica } = supabase.storage.from("logos").getPublicUrl(linha.logo_path);
  return { url: publica.publicUrl, nome: linha.nome ?? null };
}
