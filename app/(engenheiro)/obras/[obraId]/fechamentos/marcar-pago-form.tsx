"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { enviarArquivoParaStorage, removerArquivosDoStorage } from "@/lib/storage/upload-direto";

const BUCKET = "comprovantes-fechamento";

/**
 * Marca um fechamento como pago com o comprovante anexado.
 *
 * O arquivo vai direto do navegador para o Storage e a ação recebe só o
 * caminho — antes o comprovante trafegava pela Server Action (estoura o limite
 * de payload em produção) e um erro de upload era silenciosamente ignorado: o
 * fechamento virava "pago" sem comprovante nenhum e ninguém era avisado.
 */
export function MarcarPagoForm({
  prefixo,
  acao,
}: {
  /** Pasta dentro do bucket, ex: `{obraId}/{fechamentoId}`. */
  prefixo: string;
  acao: (comprovantePath: string | null) => Promise<{ error: string | null }>;
}) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    const comprovante = formData.get("comprovante");
    const temArquivo = comprovante instanceof File && comprovante.size > 0;

    startTransition(async () => {
      let path: string | null = null;

      if (temArquivo) {
        const envio = await enviarArquivoParaStorage(BUCKET, prefixo, comprovante);
        if (envio.path === null) {
          toast.error(envio.error);
          return;
        }
        path = envio.path;
      }

      const resultado = await acao(path);

      if (resultado?.error) {
        // Não foi marcado como pago — o comprovante que já subiu não deve ficar.
        if (path) await removerArquivosDoStorage(BUCKET, [path]);
        toast.error(resultado.error);
        return;
      }

      toast.success("Fechamento marcado como pago.");
      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex items-center justify-end gap-2">
      <input
        type="file"
        name="comprovante"
        accept="image/*,application/pdf"
        className="w-40 text-xs"
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Enviando..." : "Marcar pago"}
      </Button>
    </form>
  );
}
