"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PackageCheck, Undo2 } from "lucide-react";
import { confirmarRecebimentoParcela } from "@/app/actions/compras";

/**
 * Confirma o recebimento da mercadoria. Enquanto não for marcado, a parcela
 * não entra na lista de pagamentos nem vence.
 */
export function RecebimentoParcela({
  compraId,
  parcelaId,
  recebidoEm,
}: {
  compraId: string;
  parcelaId: string;
  recebidoEm: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const recebido = !!recebidoEm;

  function handleClick() {
    const mensagem = recebido
      ? "Desfazer o recebimento? A parcela sai da lista de pagamentos até ser confirmada de novo."
      : "Confirmar que a mercadoria chegou? A parcela passa a contar como pagamento pendente.";
    if (!confirm(mensagem)) return;

    startTransition(() => {
      confirmarRecebimentoParcela(compraId, parcelaId, !recebido).then(() => router.refresh());
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
