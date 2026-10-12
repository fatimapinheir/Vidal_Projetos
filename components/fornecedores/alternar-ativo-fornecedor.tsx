"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { definirAtivoFornecedor } from "@/app/actions/fornecedores";

/**
 * Inativa ou reativa o fornecedor.
 *
 * Confirma só ao inativar: é a ação que tira o fornecedor das listas de
 * compra e locação, e de fora não dá para saber que o histórico continua
 * intacto — a confirmação é onde isso se diz. Reativar não precisa: desfaz.
 */
export function AlternarAtivoFornecedor({
  fornecedorId,
  nome,
  ativo,
}: {
  fornecedorId: string;
  nome: string;
  ativo: boolean;
}) {
  const [pendente, setPendente] = useState(false);
  const router = useRouter();

  async function alternar() {
    if (
      ativo &&
      !window.confirm(
        `Inativar "${nome}"?\n\nEle sai das listas de nova ordem de compra e de locação. ` +
          `As compras e locações já registradas continuam como estão, e dá para reativar depois.`
      )
    ) {
      return;
    }

    setPendente(true);
    await definirAtivoFornecedor(fornecedorId, !ativo);
    setPendente(false);
    router.refresh();
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={alternar} disabled={pendente}>
      {ativo ? (
        <>
          <Ban className="size-4" />
          Inativar
        </>
      ) : (
        <>
          <RotateCcw className="size-4" />
          Reativar
        </>
      )}
    </Button>
  );
}
