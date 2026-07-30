"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { pagarParcelaAction } from "@/app/actions/compras";

export function PagarParcelaForm({ compraId, parcelaId }: { compraId: string; parcelaId: string }) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await pagarParcelaAction(compraId, parcelaId, formData);
        toast.success("Parcela marcada como paga.");
        formRef.current?.reset();
      } catch (err) {
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
