import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

type Client = SupabaseClient<Database>;

/**
 * Etapas escolhíveis do orçamento ATIVO da obra.
 *
 * São duas origens, e as duas precisam entrar: as etapas declaradas na versão
 * e as que só existem dentro de um item (vindas de importação de planilha).
 * As duas aparecem na tela do orçamento — oferecer só as primeiras deixaria de
 * fora justamente as obras cujo orçamento veio de planilha.
 */
export async function etapasDoOrcamentoAtivo(
  supabase: Client,
  obraId: string
): Promise<string[]> {
  const { data: versao } = await supabase
    .from("orcamento_versoes")
    .select("id, etapas")
    .eq("obra_id", obraId)
    .eq("status", "ativa")
    .maybeSingle();

  if (!versao) return [];

  const { data: emItens } = await supabase
    .from("orcamento_itens")
    .select("etapa")
    .eq("orcamento_versao_id", versao.id)
    .not("etapa", "is", null);

  return [
    ...new Set([
      ...(versao.etapas ?? []),
      ...(emItens ?? []).map((i) => i.etapa).filter((e): e is string => !!e),
    ]),
  ];
}

/**
 * Confere que a etapa escolhida existe mesmo no orçamento ativo.
 *
 * O `<select>` do formulário não é garantia: o nome da etapa viaja como texto
 * no FormData, e texto que vira coluna sem conferência acaba criando etapa
 * fantasma no comparativo orçado × comprado — uma linha de gasto numa etapa
 * que o orçamento não tem.
 */
export async function etapaOrcamentoValida(
  supabase: Client,
  obraId: string,
  escolhida: string | undefined
): Promise<{ nome: string | null; error?: string }> {
  if (!escolhida) return { nome: null };

  const { data: versao } = await supabase
    .from("orcamento_versoes")
    .select("id, etapas")
    .eq("obra_id", obraId)
    .eq("status", "ativa")
    .maybeSingle();

  if (!versao) return { nome: null, error: "Essa obra não tem orçamento ativo." };

  if (versao.etapas.includes(escolhida)) return { nome: escolhida };

  const { data: emItem } = await supabase
    .from("orcamento_itens")
    .select("etapa")
    .eq("orcamento_versao_id", versao.id)
    .eq("etapa", escolhida)
    .limit(1)
    .maybeSingle();

  if (emItem) return { nome: escolhida };
  return { nome: null, error: "Essa etapa não existe no orçamento ativo." };
}
