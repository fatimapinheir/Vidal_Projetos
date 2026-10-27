"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { alternarAtivoInsumo } from "@/app/actions/insumos";

/**
 * Tira o insumo da busca, ou devolve.
 *
 * Confirma só ao inativar — de fora não dá para saber que as compras antigas
 * continuam intactas, e a confirmação é onde isso se diz. Reativar desfaz, e
 * não precisa de pergunta.
 */
export function AlternarAtivoInsumo({
  insumoId,
  descricao,
  ativo,
}: {
  insumoId: string;
  descricao: string;
  ativo: boolean;
}) {
  const [pendente, setPendente] = useState(false);
  const router = useRouter();

  async function alternar() {
    if (
      ativo &&
      !window.confirm(
        `Inativar "${descricao}"?\n\nEle sai da busca de itens da ordem de compra e do lançamento. ` +
          `As compras já registradas continuam como estão, e dá para reativar depois.`
      )
    ) {
      return;
    }

    setPendente(true);
    await alternarAtivoInsumo(insumoId, !ativo);
    setPendente(false);
    router.refresh();
  }

  return (
    <Button type="button" variant="ghost" size="icon-sm" onClick={alternar} disabled={pendente}
      aria-label={ativo ? `Inativar ${descricao}` : `Reativar ${descricao}`}>
      {ativo ? <Ban className="size-4" /> : <RotateCcw className="size-4" />}
    </Button>
  );
}
