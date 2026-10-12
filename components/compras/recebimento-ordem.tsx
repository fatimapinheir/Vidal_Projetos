"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PackageCheck, Undo2 } from "lucide-react";
import { confirmarRecebimentoOrdem } from "@/app/actions/compras";

/**
 * Confirma o recebimento da mercadoria da ORDEM inteira.
 *
 * Enquanto não for marcado, nenhuma parcela da ordem entra na lista de
 * pagamentos nem vence. Era por parcela — ver a nota em
 * `confirmarRecebimentoOrdem`.
 */
export function RecebimentoOrdem({
  compraId,
  recebidoEm,
}: {
  compraId: string;
  recebidoEm: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const recebido = !!recebidoEm;

  function handleClick() {
    const mensagem = recebido
      ? "Desfazer o recebimento? As parcelas saem da lista de pagamentos até ser confirmado de novo."
      : "Confirmar que a mercadoria chegou? As parcelas passam a contar como pagamento pendente.";
    if (!confirm(mensagem)) return;

    startTransition(() => {
      confirmarRecebimentoOrdem(compraId, !recebido).then(() => router.refresh());
    });
  }

  return (
    <Button
      onClick={handleClick}
      disabled={pending}
      variant={recebido ? "ghost" : "outline"}
      size="sm"
    >
      {recebido ? <Undo2 className="size-4" /> : <PackageCheck className="size-4" />}
      {pending ? "Aguarde..." : recebido ? "Desfazer" : "Confirmar recebimento"}
    </Button>
  );
}
