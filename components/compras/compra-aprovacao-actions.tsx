"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  aprovarCompraAction,
  recusarCompraAction,
  pagarCompraAgoraAction,
} from "@/app/actions/compras";

export function CompraAprovacaoActions({
  compraId,
  parcelaUnicaId,
}: {
  compraId: string;
  parcelaUnicaId?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [recusarOpen, setRecusarOpen] = useState(false);
  const [pagarOpen, setPagarOpen] = useState(false);

  function handleAprovar() {
    startTransition(async () => {
      try {
        await aprovarCompraAction(compraId);
        toast.success("Ordem de compra aprovada.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao aprovar.");
      }
    });
  }

  function handleRecusar(formData: FormData) {
    startTransition(async () => {
      try {
        await recusarCompraAction(compraId, formData);
        toast.success("Ordem de compra recusada.");
        setRecusarOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao recusar.");
      }
    });
  }

  function handlePagarAgora(formData: FormData) {
    if (!parcelaUnicaId) return;
    startTransition(async () => {
      try {
        await pagarCompraAgoraAction(compraId, parcelaUnicaId, formData);
        toast.success("Ordem de compra aprovada e paga.");
        setPagarOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao pagar.");
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={handleAprovar} disabled={pending}>
        Aprovar
      </Button>

      <Dialog open={recusarOpen} onOpenChange={setRecusarOpen}>
        <DialogTrigger render={<Button variant="destructive">Recusar</Button>} />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar ordem de compra</DialogTitle>
          </DialogHeader>
          <form action={handleRecusar} className="flex flex-col gap-3">
            <Textarea name="motivo" placeholder="Motivo da recusa (opcional)" rows={3} />
            <DialogFooter>
              <Button type="submit" variant="destructive" disabled={pending}>
                Confirmar recusa
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {parcelaUnicaId && (
        <Dialog open={pagarOpen} onOpenChange={setPagarOpen}>
          <DialogTrigger render={<Button variant="outline">Pagar agora</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Pagar ordem de compra agora</DialogTitle>
            </DialogHeader>
            <form action={handlePagarAgora} className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Anexe o comprovante de pagamento. A ordem de compra será aprovada e marcada como
                paga.
              </p>
              <input
                type="file"
                name="comprovante"
                accept="image/*,application/pdf"
                required
                className="text-sm"
              />
              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  {pending ? "Enviando..." : "Confirmar pagamento"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
