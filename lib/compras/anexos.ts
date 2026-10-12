import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

type Client = SupabaseClient<Database>;

/**
 * Teto de arquivos por ordem de compra ou lançamento.
 *
 * Vale nos dois lados: aqui, para o formulário não oferecer o quarto campo, e
 * no banco, pelo gatilho `trg_limite_anexos_compra` (migração 0048) — tela é
 * conveniência, a regra é do dado.
 */
export const MAX_ANEXOS_COMPRA = 3;

/** Buckets onde um anexo de compra pode morar (ver políticas em 0006). */
export type BucketAnexo = "cotacoes" | "comprovantes-pagamento";

export type AnexoEnviado = { path: string; nome: string };

/**
 * Lê do formulário os anexos que o navegador já subiu ao Storage.
 *
 * O arquivo não trafega pela Server Action (estouraria o payload em produção —
 * ver lib/storage/upload-direto): chegam só caminho e nome, em campos
 * repetidos. O corte em MAX_ANEXOS_COMPRA é defensivo; quem recusa de verdade
 * é o gatilho no banco.
 */
export function lerAnexosDoForm(formData: FormData): AnexoEnviado[] {
  const paths = formData.getAll("anexo_path").map(String).filter(Boolean);
  const nomes = formData.getAll("anexo_nome").map(String);

  return paths.slice(0, MAX_ANEXOS_COMPRA).map((path, i) => ({
    path,
    nome: nomes[i]?.trim() || path.split("/").pop() || "arquivo",
  }));
}

/** Grava os anexos de uma compra. Devolve mensagem de erro, ou null. */
export async function salvarAnexosDaCompra(
  supabase: Client,
  compraId: string,
  bucket: BucketAnexo,
  anexos: AnexoEnviado[],
  criadoPor: string
): Promise<string | null> {
  if (!anexos.length) return null;

  const { error } = await supabase.from("compra_anexos").insert(
    anexos.map((anexo) => ({
      compra_id: compraId,
      bucket,
      path: anexo.path,
      nome: anexo.nome,
      criado_por: criadoPor,
    }))
  );

  return error ? "Não foi possível salvar os arquivos anexados." : null;
}

/**
 * Todo arquivo no Storage que pertence a esta compra, por bucket.
 *
 * Sai dos caminhos gravados no banco, não da convenção de pasta — mesmo
 * motivo de `arquivosDaObra` em app/actions/obras.ts. Inclui o comprovante da
 * parcela e o `anexo_cotacao_path` antigo (obsoleto desde 0048) porque
 * exclusão que deixa arquivo para trás continua custando armazenamento.
 */
export async function arquivosDaCompra(
  supabase: Client,
  compraId: string
): Promise<{ bucket: string; paths: string[] }[]> {
  const [anexos, parcelas, compra] = await Promise.all([
    supabase.from("compra_anexos").select("bucket, path").eq("compra_id", compraId),
    supabase
      .from("compra_parcelas")
      .select("comprovante_pagamento_path")
      .eq("compra_id", compraId)
      .not("comprovante_pagamento_path", "is", null),
    supabase.from("compras").select("anexo_cotacao_path").eq("id", compraId).maybeSingle(),
  ]);

  const porBucket = new Map<string, Set<string>>();
  const juntar = (bucket: string, path: string | null) => {
    if (!path?.trim()) return;
    const atual = porBucket.get(bucket) ?? new Set<string>();
    atual.add(path);
    porBucket.set(bucket, atual);
  };

  for (const anexo of anexos.data ?? []) juntar(anexo.bucket, anexo.path);
  for (const p of parcelas.data ?? []) juntar("comprovantes-pagamento", p.comprovante_pagamento_path);
  juntar("cotacoes", compra.data?.anexo_cotacao_path ?? null);

  return [...porBucket].map(([bucket, paths]) => ({ bucket, paths: [...paths] }));
}
