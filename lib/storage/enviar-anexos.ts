"use client";

import { enviarArquivoParaStorage, removerArquivosDoStorage } from "@/lib/storage/upload-direto";

export type AnexoEnviado = { path: string; nome: string };

/**
 * Sobe uma leva de anexos ao Storage e devolve os caminhos para o FormData.
 *
 * Em SÉRIE, e com faxina: se o terceiro arquivo falhar, os dois que já subiram
 * são removidos antes de desistir. Sem isso, a tentativa frustrada deixa
 * arquivo órfão no bucket — que foi exatamente o que gerou os 48 MB de lixo que
 * precisaram de um script para achar.
 *
 * O arquivo não trafega pela Server Action (estouraria o payload em produção —
 * ver `upload-direto`): o que entra no FormData é caminho e nome.
 *
 * Devolve `null` em `anexos` quando falhou, com a mensagem em `error`. Erro de
 * upload descartado em silêncio fazia a ordem nascer sem o anexo que o usuário
 * achava ter enviado.
 */
export async function enviarAnexos(
  bucket: string,
  prefixo: string,
  arquivos: File[]
): Promise<{ anexos: AnexoEnviado[]; error: null } | { anexos: null; error: string }> {
  const enviados: AnexoEnviado[] = [];

  for (const arquivo of arquivos) {
    const envio = await enviarArquivoParaStorage(bucket, prefixo, arquivo);
    if (envio.path === null) {
      await removerArquivosDoStorage(
        bucket,
        enviados.map((e) => e.path)
      );
      return { anexos: null, error: envio.error };
    }
    enviados.push({ path: envio.path, nome: arquivo.name });
  }

  return { anexos: enviados, error: null };
}

/** Acrescenta ao FormData os campos que `lerAnexosDoForm` espera do outro lado. */
export function anexarAoForm(formData: FormData, anexos: AnexoEnviado[]) {
  for (const anexo of anexos) {
    formData.append("anexo_path", anexo.path);
    formData.append("anexo_nome", anexo.nome);
  }
}
