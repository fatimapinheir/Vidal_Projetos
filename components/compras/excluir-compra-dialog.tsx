"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { excluirCompra } from "@/app/actions/compras";

/**
 * Lixeira na linha da lista.
 *
 * Mora na lista, e não na tela de detalhe, porque excluir é decisão que se
 * toma olhando a fila — "este lançamento aqui está errado" — e não depois de
 * abrir o registro.
 *
 * A confirmação fica, mesmo sendo um clique a mais: o valor sai do custo da
 * obra na hora, não há desfazer, e a lixeira é vizinha do botão de abrir. Sem
 * ela, um toque errado no celular apaga um pagamento.
 */
export function ExcluirCompraDialog({
  compraId,
  descricao,
  ehLancamento,
}: {
  compraId: string;
  descricao: string;
  ehLancamento: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, iniciarExclusao] = useTransition();
  const router = useRouter();

  const rotulo = ehLancamento ? "lançamento" : "ordem de compra";

  function handleExcluir() {
    setErro(null);
    iniciarExclusao(async () => {
      const resultado = await excluirCompra(compraId);
      if (resultado.error) return setErro(resultado.error);

      setOpen(false);
      // A lista é renderizada no servidor: sem o refresh, a linha apagada
      // continua na tela.
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(proximo) => {
        setOpen(proximo);
        if (!proximo) setErro(null);
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Excluir ${rotulo}: ${descricao}`}
            title={`Excluir ${rotulo}`}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="size-4 text-destructive" />
            Excluir {rotulo}
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{descricao}</span> sai do custo da obra
            junto com os itens, {ehLancamento ? "o pagamento" : "as parcelas"} e os arquivos
            anexados. Não há como desfazer.
          </DialogDescription>
        </DialogHeader>

        {erro && <FieldError>{erro}</FieldError>}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={excluindo}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleExcluir} disabled={excluindo}>
            <Trash2 className="size-4" />
            {excluindo ? "Excluindo..." : "Excluir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
