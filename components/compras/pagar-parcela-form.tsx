"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { pagarParcelaAction } from "@/app/actions/compras";
import { enviarArquivoParaStorage, removerArquivosDoStorage } from "@/lib/storage/upload-direto";

export function PagarParcelaForm({
  obraId,
  compraId,
  parcelaId,
}: {
  obraId: string;
  compraId: string;
  parcelaId: string;
}) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    const comprovante = formData.get("comprovante");
    if (!(comprovante instanceof File) || comprovante.size === 0) {
      toast.error("Anexe o comprovante de pagamento.");
      return;
    }

    startTransition(async () => {
      // Direto ao Storage: foto de comprovante tirada no celular passa do
      // limite de payload da função em produção.
      const envio = await enviarArquivoParaStorage(
        "comprovantes-pagamento",
        `${obraId}/${compraId}`,
        comprovante
      );
      if (envio.path === null) {
        toast.error(envio.error);
        return;
      }

      try {
        await pagarParcelaAction(compraId, parcelaId, envio.path);
        toast.success("Parcela marcada como paga.");
        formRef.current?.reset();
      } catch (err) {
        // A parcela não foi paga — tira o comprovante que já subiu.
        await removerArquivosDoStorage("comprovantes-pagamento", [envio.path]);
        toast.error(err instanceof Error ? err.message : "Erro ao marcar parcela.");
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex items-center gap-2">
      <input
        type="file"
        name="comprovante"
        accept="image/*,application/pdf"
        required
        className="w-40 text-xs"
      />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Enviando..." : "Marcar paga"}
      </Button>
    </form>
  );
}
