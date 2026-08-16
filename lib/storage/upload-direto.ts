"use client";

import { createClient } from "@/lib/supabase/client";
import { sanitizeFilename } from "@/lib/sanitize-filename";

/**
 * Envia um arquivo do navegador direto para o Storage do Supabase, sem passar
 * pela Server Action.
 *
 * Motivo: em produção (Netlify) as funções síncronas aceitam 6 MB de payload, e
 * binário viaja em base64 (+33%) — na prática ~4,5 MB. Uma planilha SINAPI real
 * ou um punhado de fotos de celular estoura isso e a ação falha, mesmo
 * funcionando em desenvolvimento, onde não existe esse limite. Mandando o
 * arquivo direto, pela função só trafega o caminho (uma string).
 *
 * A escrita é autorizada pela sessão do próprio usuário: os buckets têm policy
 * de `is_engenheiro()`, então isso não abre nada que a ação já não pudesse
 * fazer.
 */
export async function enviarArquivoParaStorage(
  bucket: string,
  prefixo: string,
  arquivo: File
): Promise<{ path: string; error: null } | { path: null; error: string }> {
  const supabase = createClient();

  // Chaves do Storage rejeitam caracteres não-ASCII (ver lib/sanitize-filename).
  const path = `${prefixo}/${Date.now()}-${sanitizeFilename(arquivo.name)}`;

  const { error } = await supabase.storage.from(bucket).upload(path, arquivo);

  if (error) {
    return { path: null, error: `Não foi possível enviar "${arquivo.name}".` };
  }

  return { path, error: null };
}

/**
 * Remove do Storage arquivos que já subiram mas cuja operação não se completou.
 *
 * Sem isso, todo caminho de erro depois do upload deixa objeto órfão no bucket:
 * ninguém o referencia, ele nunca aparece na tela e continua ocupando espaço
 * pago. É best-effort de propósito — se a remoção falhar, o erro original é o
 * que interessa ao usuário.
 */
export async function removerArquivosDoStorage(bucket: string, paths: string[]) {
  if (!paths.length) return;
  const supabase = createClient();
  await supabase.storage.from(bucket).remove(paths);
}
