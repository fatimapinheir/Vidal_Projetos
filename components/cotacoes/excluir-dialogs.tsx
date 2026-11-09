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
import { excluirCotacao, excluirProposta } from "@/app/actions/cotacoes";

/** Lixeira na linha — o padrão de exclusão do projeto. */
export function ExcluirCotacaoDialog({
  cotacaoId,
  descricao,
  decidida,
}: {
  cotacaoId: string;
  descricao: string;
  /** Cotação já decidida: a ordem de compra gerada sobrevive, e vale dizer isso. */
  decidida: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, iniciar] = useTransition();
  const router = useRouter();

  function handleExcluir() {
    setErro(null);
    iniciar(async () => {
      const resultado = await excluirCotacao(cotacaoId);
      if (resultado.error) return setErro(resultado.error);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={`Excluir cotação ${descricao}`}>
            <Trash2 className="size-4" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="size-4 text-destructive" aria-hidden />
            Excluir cotação?
          </DialogTitle>
          <DialogDescription>
            {`"${descricao}" sai junto com todas as propostas, os itens, as parcelas propostas e os arquivos anexados. Não há como desfazer.`}
            {decidida &&
              " A ordem de compra que saiu desta cotação continua, intacta — só perde o vínculo."}
          </DialogDescription>
        </DialogHeader>
        {erro && <FieldError>{erro}</FieldError>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={excluindo}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleExcluir} disabled={excluindo}>
            {excluindo ? "Excluindo..." : "Excluir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ExcluirPropostaDialog({
  propostaId,
  fornecedor,
}: {
  propostaId: string;
  fornecedor: string;
}) {
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, iniciar] = useTransition();
  const router = useRouter();

  function handleExcluir() {
    setErro(null);
    iniciar(async () => {
      const resultado = await excluirProposta(propostaId);
      if (resultado.error) return setErro(resultado.error);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={`Excluir proposta de ${fornecedor}`}>
            <Trash2 className="size-4" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir a proposta de {fornecedor}?</DialogTitle>
          <DialogDescription>
            Sai com os itens, as parcelas e o arquivo anexado. Não há como desfazer.
          </DialogDescription>
        </DialogHeader>
        {erro && <FieldError>{erro}</FieldError>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={excluindo}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleExcluir} disabled={excluindo}>
            {excluindo ? "Excluindo..." : "Excluir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
