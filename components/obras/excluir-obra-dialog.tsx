"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Trash2, TriangleAlert } from "lucide-react";
import { resumoExclusaoObra, excluirObra, type ResumoExclusao } from "@/app/actions/obras";

/**
 * Exclusão de obra, com o que vai embora na cara do usuário antes de confirmar.
 *
 * O resumo é carregado só na abertura: são doze consultas para uma ação rara, e
 * o dashboard lista todas as obras — pagar isso em cada carregamento da tela
 * seria absurdo.
 *
 * O nome digitado existe porque não há desfazer. Um `confirm()` é um Enter
 * distraído; copiar o nome da obra obriga a olhar qual obra está sendo apagada,
 * que é justamente o erro que acontece quando há três obras parecidas na lista.
 */
export function ExcluirObraDialog({ obraId, nome }: { obraId: string; nome: string }) {
  const [open, setOpen] = useState(false);
  const [resumo, setResumo] = useState<ResumoExclusao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState("");
  const [carregando, iniciarCarga] = useTransition();
  const [excluindo, iniciarExclusao] = useTransition();
  const router = useRouter();

  function handleOpenChange(proximo: boolean) {
    setOpen(proximo);
    if (!proximo) {
      setResumo(null);
      setErro(null);
      setConfirmacao("");
      return;
    }

    iniciarCarga(async () => {
      const resultado = await resumoExclusaoObra(obraId);
      if ("error" in resultado) setErro(resultado.error);
      else setResumo(resultado);
    });
  }

  function handleExcluir() {
    setErro(null);
    iniciarExclusao(async () => {
      const resultado = await excluirObra(obraId, confirmacao);
      if (resultado.error) return setErro(resultado.error);

      if (resultado.avisos?.length) {
        alert(`Obra excluída, com pendências:\n\n${resultado.avisos.join("\n")}`);
      }
      setOpen(false);
      router.refresh();
    });
  }

  const nomeConfere = confirmacao.trim() === nome.trim();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Excluir a obra ${nome}`}
            title="Excluir obra"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        }
      />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="size-4 text-destructive" />
            Excluir {nome}
          </DialogTitle>
          <DialogDescription>
            Isso apaga a obra e tudo que pertence a ela. Não há como desfazer, e não existe
            backup dentro do sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
          {carregando && <p className="text-sm text-muted-foreground">Levantando o que será apagado...</p>}

          {resumo && (
            <>
              {resumo.contagens.length ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Vai embora
                  </p>
                  <ul className="flex flex-col gap-1 text-sm">
                    {resumo.contagens.map((linha) => (
                      <li key={linha.rotulo} className="flex justify-between gap-3">
                        <span>{linha.rotulo}</span>
                        <span className="font-medium tabular-nums">{linha.quantidade}</span>
                      </li>
                    ))}
                    {resumo.arquivos > 0 && (
                      <li className="flex justify-between gap-3 border-t pt-1">
                        <span>Arquivos anexados (fotos, comprovantes, planilhas)</span>
                        <span className="font-medium tabular-nums">{resumo.arquivos}</span>
                      </li>
                    )}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Essa obra não tem nenhum lançamento — só o cadastro dela.
                </p>
              )}

              {!!resumo.clientesParaApagar.length && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Contas de acesso que serão apagadas
                  </p>
                  <ul className="flex flex-col gap-1 text-sm">
                    {resumo.clientesParaApagar.map((cliente) => (
                      <li key={cliente.id}>
                        {cliente.nome}{" "}
                        <span className="text-muted-foreground">({cliente.email})</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Essas pessoas perdem o login no portal. São clientes só desta obra.
                  </p>
                </div>
              )}

              {!!resumo.clientesPreservados.length && (
                <div className="rounded-lg border p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Contas que ficam
                  </p>
                  <ul className="flex flex-col gap-1 text-sm">
                    {resumo.clientesPreservados.map((cliente) => (
                      <li key={cliente.email}>
                        {cliente.nome}{" "}
                        <span className="text-muted-foreground">
                          — {cliente.outrasObras > 0
                            ? `também tem ${cliente.outrasObras} outra(s) obra(s)`
                            : "não é conta de cliente"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Field>
                <FieldLabel htmlFor="confirmacao">
                  Digite <span className="font-mono font-semibold">{nome}</span> para confirmar
                </FieldLabel>
                <Input
                  id="confirmacao"
                  value={confirmacao}
                  onChange={(e) => setConfirmacao(e.target.value)}
                  autoComplete="off"
                  placeholder={nome}
                />
              </Field>
            </>
          )}

          {erro && <FieldError>{erro}</FieldError>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={excluindo}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleExcluir}
            disabled={!resumo || !nomeConfere || excluindo}
          >
            <Trash2 className="size-4" />
            {excluindo ? "Excluindo..." : "Excluir definitivamente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
