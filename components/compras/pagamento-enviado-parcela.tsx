"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Send, Undo2 } from "lucide-react";
import { marcarPagamentoEnviado } from "@/app/actions/compras";

/**
 * Registra que o pagamento da parcela foi lançado.
 *
 * Fica ao lado de "Confirmar recebimento" e de "Pagar" porque é o passo do
 * meio: recebeu a mercadoria, lançou o pagamento, depois confirma com o
 * comprovante. Sem ele a parcela voltava a aparecer como vencida no dia
 * seguinte ao lançamento.
 */
export function PagamentoEnviadoParcela({
  compraId,
  parcelaId,
  enviadoEm,
}: {
  compraId: string;
  parcelaId: string;
  enviadoEm: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const enviado = !!enviadoEm;

  function handleClick() {
    const mensagem = enviado
      ? "Desfazer o envio? A parcela volta a contar como pagamento em aberto e pode voltar a aparecer como vencida."
      : "Registrar que o pagamento foi lançado? A parcela sai da lista de vencidas, mas segue em aberto até o comprovante ser anexado.";
    if (!confirm(mensagem)) return;

    startTransition(async () => {
      try {
        await marcarPagamentoEnviado(compraId, parcelaId, !enviado);
      } catch (erro) {
        alert(erro instanceof Error ? erro.message : "Não foi possível registrar o envio.");
      }
      router.refresh();
    });
  }

  return (
    <Button
      onClick={handleClick}
      disabled={pending}
      variant={enviado ? "ghost" : "outline"}
      size="sm"
    >
      {enviado ? <Undo2 className="size-4" /> : <Send className="size-4" />}
      {pending ? "Aguarde..." : enviado ? "Desfazer envio" : "Pagamento enviado"}
    </Button>
  );
}
