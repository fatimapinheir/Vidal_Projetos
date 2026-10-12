"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-role";
import { MAX_ANEXOS_COMPRA, type BucketAnexo } from "@/lib/compras/anexos";

export type AnexoState = { error: string | null };

/** Os dois lados veem a mesma compra; os dois caches precisam cair. */
function revalidar(obraId: string, compraId: string) {
  revalidatePath(`/obras/${obraId}/compras/${compraId}`);
  revalidatePath(`/obras/${obraId}/compras`);
  revalidatePath(`/portal/obras/${obraId}/compras/${compraId}`);
  revalidatePath(`/portal/obras/${obraId}/compras`);
}

/**
 * Anexa arquivos a uma compra que já existe.
 *
 * Existe porque esquecer o comprovante na pressa é normal, e sem isto a saída
 * era apagar o lançamento e digitar tudo de novo — um registro financeiro
 * destruído e recriado por causa de um arquivo.
 *
 * O arquivo já subiu ao Storage pelo navegador; aqui chega só o caminho (ver
 * lib/storage/upload-direto). O limite de três é conferido antes de inserir
 * para a mensagem ser clara, mas quem garante é o gatilho do banco.
 */
export async function adicionarAnexosCompra(
  compraId: string,
  anexos: { path: string; nome: string }[]
): Promise<AnexoState> {
  const profile = await requireRole("engenheiro");
  if (!anexos.length) return { error: null };

  const supabase = await createClient();

  const { data: compra } = await supabase
    .from("compras")
    .select("id, obra_id, eh_lancamento")
    .eq("id", compraId)
    .maybeSingle();

  if (!compra) return { error: "Registro não encontrado." };

  const { count } = await supabase
    .from("compra_anexos")
    .select("id", { count: "exact", head: true })
    .eq("compra_id", compraId);

  const jaTem = count ?? 0;
  if (jaTem + anexos.length > MAX_ANEXOS_COMPRA) {
    const livres = MAX_ANEXOS_COMPRA - jaTem;
    return {
      error: livres > 0
        ? `Cabe mais ${livres} arquivo${livres > 1 ? "s" : ""} — o limite é ${MAX_ANEXOS_COMPRA}.`
        : `Este registro já tem ${MAX_ANEXOS_COMPRA} arquivos. Remova um antes de anexar outro.`,
    };
  }

  // O bucket sai da natureza do registro, não de quem chamou: cotação é do
  // engenheiro, comprovante o cliente também lê e envia (ver 0006).
  const bucket: BucketAnexo = compra.eh_lancamento ? "comprovantes-pagamento" : "cotacoes";

  const { error } = await supabase.from("compra_anexos").insert(
    anexos.map((a) => ({
      compra_id: compraId,
      bucket,
      path: a.path,
      nome: a.nome,
      criado_por: profile.id,
    }))
  );

  if (error) return { error: "Não foi possível anexar os arquivos." };

  revalidar(compra.obra_id, compraId);
  return { error: null };
}

/**
 * Remove um anexo, da tabela e do bucket.
 *
 * O arquivo sai do Storage com a service key, e não com a sessão: é o mesmo
 * motivo de `excluirCompra` — o cliente não tem (nem deve ter) permissão de
 * apagar objeto em `comprovantes-pagamento`, porque isso abriria sumir com
 * comprovante de qualquer parcela da obra.
 */
export async function removerAnexoCompra(anexoId: string): Promise<AnexoState> {
  await requireRole("engenheiro");
  const supabase = await createClient();

  const { data: anexo } = await supabase
    .from("compra_anexos")
    .select("id, bucket, path, compra_id, compras!inner(obra_id)")
    .eq("id", anexoId)
    .maybeSingle();

  if (!anexo) return { error: "Anexo não encontrado." };

  const { error } = await supabase.from("compra_anexos").delete().eq("id", anexoId);
  if (error) return { error: "Não foi possível remover o anexo." };

  // Best-effort: a linha já se foi, e falha ao apagar o objeto não deve
  // transformar uma remoção concluída em erro na tela.
  await createAdminClient().storage.from(anexo.bucket).remove([anexo.path]);

  const obraId = (anexo.compras as unknown as { obra_id: string }).obra_id;
  revalidar(obraId, anexo.compra_id);
  return { error: null };
}
