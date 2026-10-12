"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  listarObrasParaCopia,
  copiarDeOutraObra,
  type ObraOrigem,
} from "@/app/actions/copiar-obra";

const CLASSE_SELECT = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

function hojeIso() {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

/**
 * Copia orçamento e cronograma de outra obra.
 *
 * Construtora repete projeto: a segunda casa do mesmo padrão reaproveita quase
 * todo o orçamento e o cronograma. Remontar 227 itens e 130 tarefas à mão não
 * é trabalho, é desperdício.
 *
 * O orçamento entra como RASCUNHO — preço e escopo mudam entre obras, e o
 * cliente não deve ver antes da revisão. O cronograma pede uma data de início
 * nova: copiar as datas da obra antiga produziria um cronograma que já nasce
 * vencido.
 */
export function CopiarDeOutraObraDialog({
  obraId,
  padrao,
  variante = "outline",
}: {
  /** A obra de DESTINO — a que vai receber a cópia. */
  obraId: string;
  /** O que vem marcado ao abrir, conforme a tela de onde se chamou. */
  padrao?: { orcamento?: boolean; cronograma?: boolean };
  variante?: "outline" | "default";
}) {
  const [open, setOpen] = useState(false);
  const [obras, setObras] = useState<ObraOrigem[] | null>(null);
  const [origemId, setOrigemId] = useState("");
  const [comOrcamento, setComOrcamento] = useState(padrao?.orcamento ?? true);
  const [comCronograma, setComCronograma] = useState(padrao?.cronograma ?? true);
  const [inicio, setInicio] = useState(hojeIso());
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, iniciarCarga] = useTransition();
  const [copiando, iniciarCopia] = useTransition();
  const router = useRouter();

  function handleOpenChange(proximo: boolean) {
    setOpen(proximo);
    if (!proximo) {
      setErro(null);
      return;
    }
    setComOrcamento(padrao?.orcamento ?? true);
    setComCronograma(padrao?.cronograma ?? true);
    iniciarCarga(async () => setObras(await listarObrasParaCopia(obraId)));
  }

  function copiar() {
    setErro(null);
    iniciarCopia(async () => {
      const r = await copiarDeOutraObra(obraId, {
        origemId,
        copiarOrcamento: comOrcamento,
        copiarCronograma: comCronograma,
        inicioCronograma: comCronograma ? inicio : undefined,
      });
      if (r.error) return setErro(r.error);
      setOpen(false);
      router.refresh();
    });
  }

  const origem = obras?.find((o) => o.id === origemId);
  const podeCopiar = !!origemId && (comOrcamento || comCronograma) && !copiando;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant={variante}>
            <Copy className="size-4" />
            Copiar de outra obra
          </Button>
        }
      />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Copiar de outra obra</DialogTitle>
          <DialogDescription>
            Traz o orçamento e o cronograma de uma obra já montada para esta. Nada da obra de
            origem é alterado.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="origem">Obra de origem</FieldLabel>
            {carregando && <p className="text-sm text-muted-foreground">Procurando obras...</p>}
            {!carregando && obras && !obras.length && (
              <p className="text-sm text-muted-foreground">
                Nenhuma outra obra tem orçamento ativo ou cronograma para copiar.
              </p>
            )}
            {!!obras?.length && (
              <select
                id="origem"
                value={origemId}
                onChange={(e) => setOrigemId(e.target.value)}
                className={CLASSE_SELECT}
              >
                <option value="">Selecione...</option>
                {obras.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome} — {o.itensOrcamento} itens, {o.tarefasCronograma} tarefas
                  </option>
                ))}
              </select>
            )}
          </Field>

          {origem && (
            <>
              <Field orientation="horizontal">
                <Checkbox
                  id="com_orcamento"
                  checked={comOrcamento}
                  disabled={!origem.itensOrcamento}
                  onCheckedChange={(m) => setComOrcamento(m === true)}
                />
                <FieldContent>
                  <FieldLabel htmlFor="com_orcamento">
                    Orçamento — {origem.itensOrcamento}{" "}
                    {origem.itensOrcamento === 1 ? "item" : "itens"}
                  </FieldLabel>
                  <FieldDescription>
                    {origem.itensOrcamento
                      ? "Entra como rascunho. Quantidades e preços vêm como estão, para você revisar antes de ativar."
                      : "Essa obra não tem orçamento ativo."}
                  </FieldDescription>
                </FieldContent>
              </Field>

              <Field orientation="horizontal">
                <Checkbox
                  id="com_cronograma"
                  checked={comCronograma}
                  disabled={!origem.tarefasCronograma}
                  onCheckedChange={(m) => setComCronograma(m === true)}
                />
                <FieldContent>
                  <FieldLabel htmlFor="com_cronograma">
                    Cronograma — {origem.tarefasCronograma}{" "}
                    {origem.tarefasCronograma === 1 ? "tarefa" : "tarefas"}
                  </FieldLabel>
                  <FieldDescription>
                    {origem.tarefasCronograma
                      ? "Etapas, tarefas e a ordem entre elas. As durações são mantidas; as datas se deslocam para o novo início."
                      : "Essa obra não tem cronograma."}
                  </FieldDescription>
                </FieldContent>
              </Field>

              {comCronograma && !!origem.tarefasCronograma && (
                <Field>
                  <FieldLabel htmlFor="inicio">Início do cronograma nesta obra</FieldLabel>
                  <Input
                    id="inicio"
                    type="date"
                    value={inicio}
                    onChange={(e) => setInicio(e.target.value)}
                    required
                  />
                  <FieldDescription>
                    Todo o cronograma é deslocado para começar nessa data, mantendo o espaçamento
                    entre as frentes.
                  </FieldDescription>
                </Field>
              )}
            </>
          )}

          {erro && <FieldError>{erro}</FieldError>}

          <div className="flex gap-2">
            <Button onClick={copiar} disabled={!podeCopiar}>
              {copiando ? "Copiando..." : "Copiar"}
            </Button>
            <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={copiando}>
              Cancelar
            </Button>
          </div>
        </FieldGroup>
      </DialogContent>
    </Dialog>
  );
}
