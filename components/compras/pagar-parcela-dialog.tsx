"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldDescription, FieldError } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { pagarParcelaAction } from "@/app/actions/compras";
import { enviarArquivoParaStorage, removerArquivosDoStorage } from "@/lib/storage/upload-direto";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Marcar uma parcela como paga, com o comprovante.
 *
 * O campo de arquivo morava dentro da linha da tabela, ao lado do botão. Numa
 * tela de celular isso empurrava a tabela para fora da largura: o cliente
 * precisava rolar na horizontal até achar o "Escolher arquivo", voltar para
 * conferir de qual parcela era, e só então apertar. Em diálogo, o botão da
 * linha é só um botão, e o anexo acontece numa tela que diz de qual parcela
 * se trata.
 *
 * A ordem continua a mesma: o arquivo sobe primeiro, direto ao Storage, e a
 * ação recebe só o caminho — foto de comprovante tirada no celular estoura o
 * limite de payload da função em produção. Falhando a ação, o arquivo que
 * subiu é removido.
 */
export function PagarParcelaDialog({
  obraId,
  compraId,
  parcelaId,
  valor,
  vencimento,
}: {
  obraId: string;
  compraId: string;
  parcelaId: string;
  valor: number;
  /** Já formatado pela tela, que é quem conhece o fuso da obra. */
  vencimento: string | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  function confirmar() {
    if (!arquivo) {
      setErro("Anexe o comprovante de pagamento.");
      return;
    }
    setErro(null);

    iniciar(async () => {
      const envio = await enviarArquivoParaStorage(
        "comprovantes-pagamento",
        `${obraId}/${compraId}`,
        arquivo
      );
      if (envio.path === null) {
        setErro(envio.error);
        return;
      }

      try {
        await pagarParcelaAction(compraId, parcelaId, envio.path);
        toast.success("Parcela marcada como paga.");
        setArquivo(null);
        setAberto(false);
      } catch (err) {
        await removerArquivosDoStorage("comprovantes-pagamento", [envio.path]);
        setErro(err instanceof Error ? err.message : "Erro ao marcar a parcela.");
      }
    });
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(proximo) => {
        setAberto(proximo);
        if (!proximo) {
          setArquivo(null);
          setErro(null);
        }
      }}
    >
      <DialogTrigger render={<Button size="sm">Marcar paga</Button>} />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar parcela como paga</DialogTitle>
          <DialogDescription>
            {moeda(valor)}
            {vencimento ? ` · vence ${vencimento}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-muted">
              <Paperclip className="size-4" aria-hidden />
              {arquivo ? "Trocar arquivo" : "Escolher arquivo"}
              <input
                type="file"
                accept="image/*,application/pdf"
                className="sr-only"
                disabled={enviando}
                onChange={(e) => {
                  setErro(null);
                  setArquivo(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </label>
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {arquivo ? arquivo.name : "Nenhum arquivo escolhido"}
            </span>
          </div>
          <FieldDescription>
            Foto ou PDF do comprovante. Sem ele o pagamento não é registrado.
          </FieldDescription>
          {erro && <FieldError>{erro}</FieldError>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setAberto(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={enviando || !arquivo}>
            {enviando ? "Enviando..." : "Confirmar pagamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
