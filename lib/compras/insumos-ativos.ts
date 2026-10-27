import type { createClient } from "@/lib/supabase/server";
import type { InsumoOpcao } from "@/components/compras/item-compra-picker";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * O catálogo de insumos ativos, para a busca de item da compra.
 *
 * Vem inteiro e filtra no navegador. O catálogo de uma construtora tem
 * centenas de linhas, não milhares, e isso responde na tecla — era a demora da
 * busca por requisição que fazia todo mundo ignorar o seletor antigo e
 * redigitar tudo à mão.
 *
 * Os inativos ficam de fora: eles continuam na tela de insumos e nas compras
 * antigas, mas não devem poluir quem está lançando hoje.
 */
export async function buscarInsumosAtivos(supabase: Supabase): Promise<InsumoOpcao[]> {
  const { data } = await supabase
    .from("insumos")
    .select("id, descricao, categoria_custo, unidade")
    .eq("ativo", true)
    .order("descricao");

  return data ?? [];
}
