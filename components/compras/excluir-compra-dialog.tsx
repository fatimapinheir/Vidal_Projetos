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
 * Exclusão de um lançamento financeiro ou ordem de compra.
 *
 * Sem o "digite o nome" da exclusão de obra: lá são doze tabelas e contas de
 * acesso de outras pessoas, aqui é um registro só. Mas com confirmação, porque
 * o valor sai do custo da obra na hora e não há desfazer.
 */
export function ExcluirCompraDialog({
  compraId,
  descricao,
  ehLancamento,
  voltarPara,
}: {
  compraId: string;
  descricao: string;
  ehLancamento: boolean;
  /** Lista para onde voltar depois — a linha aberta deixa de existir. */
  voltarPara: string;
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
      router.push(voltarPara);
      // A lista é renderizada no servidor e já está em cache no cliente: sem o
      // refresh, a linha apagada reaparece por um instante.
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
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-4" />
            Excluir
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
            {excluindo ? "Excluindo..." : `Excluir ${rotulo}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
