"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { enviarArquivoParaStorage, removerArquivosDoStorage } from "@/lib/storage/upload-direto";
import { MAX_ANEXOS_COMPRA, type BucketAnexo } from "@/lib/compras/anexos";
import { adicionarAnexosCompra, removerAnexoCompra } from "@/app/actions/anexos-compra";

export type AnexoExistente = { id: string; nome: string; url: string | null };

/**
 * Os anexos de uma compra já criada, com adicionar e remover.
 *
 * Antes os arquivos só entravam no momento do cadastro, e esquecer o
 * comprovante custava o registro inteiro: a única saída era excluir e digitar
 * tudo de novo. Anexar depois é a operação mais banal que existe num
 * lançamento, e era justamente a que não dava.
 *
 * O envio vai direto ao Storage (ver lib/storage/upload-direto) e a ação
 * recebe só o caminho. Em série, removendo o que já subiu se um falhar, para
 * tentativa frustrada não deixar arquivo órfão no bucket.
 */
export function AnexosCompra({
  compraId,
  obraId,
  bucket,
  anexos,
  podeEditar,
}: {
  compraId: string;
  obraId: string;
  /** Onde este registro guarda arquivo — cotação ou comprovante. */
  bucket: BucketAnexo;
  anexos: AnexoExistente[];
  podeEditar: boolean;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [removendo, iniciarRemocao] = useTransition();
  const router = useRouter();

  const livres = MAX_ANEXOS_COMPRA - anexos.length;

  async function aoEscolher(escolhidos: FileList | null) {
    setErro(null);
    if (!escolhidos?.length) return;

    const arquivos = [...escolhidos].slice(0, Math.max(livres, 0));
    if (!arquivos.length) {
      setErro(`Este registro já tem ${MAX_ANEXOS_COMPRA} arquivos. Remova um antes de anexar outro.`);
      return;
    }

    setEnviando(true);
    const enviados: { path: string; nome: string }[] = [];
    for (const arquivo of arquivos) {
      const envio = await enviarArquivoParaStorage(bucket, obraId, arquivo);
      if (envio.path === null) {
        await removerArquivosDoStorage(bucket, enviados.map((e) => e.path));
        setEnviando(false);
        setErro(envio.error);
        return;
      }
      enviados.push({ path: envio.path, nome: arquivo.name });
    }

    const resultado = await adicionarAnexosCompra(compraId, enviados);
    setEnviando(false);
    if (resultado.error) {
      await removerArquivosDoStorage(bucket, enviados.map((e) => e.path));
      setErro(resultado.error);
      return;
    }
    router.refresh();
  }

  function remover(id: string, nome: string) {
    if (!confirm(`Remover "${nome}"? O arquivo é apagado e não há como desfazer.`)) return;
    setErro(null);
    iniciarRemocao(async () => {
      const resultado = await removerAnexoCompra(id);
      if (resultado.error) return setErro(resultado.error);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {anexos.length ? (
        <ul className="flex flex-col gap-1">
          {anexos.map((anexo) => (
            <li key={anexo.id} className="flex items-center gap-2 text-sm">
              <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              {anexo.url ? (
                <a
                  href={anexo.url}
                  target="_blank"
                  rel="noreferrer"
                  title={anexo.nome}
                  className="min-w-0 flex-1 truncate font-medium text-primary-texto underline underline-offset-4"
                >
                  {anexo.nome}
                </a>
              ) : (
                <span className="min-w-0 flex-1 truncate font-medium">{anexo.nome}</span>
              )}
              {podeEditar && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remover ${anexo.nome}`}
                  disabled={removendo || enviando}
                  onClick={() => remover(anexo.id, anexo.nome)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum arquivo anexado.</p>
      )}

      {podeEditar && livres > 0 && (
        <label
          className={
            enviando
              ? "inline-flex w-fit items-center gap-2 rounded-lg border border-border bg-muted px-2.5 py-1.5 text-xs font-medium text-muted-foreground"
              : "inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium shadow-xs transition-colors hover:bg-muted"
          }
        >
          <Paperclip className="size-3.5" aria-hidden />
          {enviando ? "Enviando..." : `Anexar arquivo (cabe ${livres})`}
          <input
            type="file"
            multiple
            className="sr-only"
            disabled={enviando || removendo}
            onChange={(e) => {
              void aoEscolher(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      )}

      {erro && <FieldError>{erro}</FieldError>}
    </div>
  );
}
