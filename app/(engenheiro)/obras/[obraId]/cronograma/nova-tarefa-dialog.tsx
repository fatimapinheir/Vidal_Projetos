"use client";

import { useState, useTransition } from "react";
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
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { criarTarefa } from "@/app/actions/cronograma";

const CLASSE_SELECT = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

/**
 * Nova tarefa — só o planejado.
 *
 * A predecessora virou uma pergunta direta: tem ou não tem, e qual. Antes era
 * uma caixa "iniciar automaticamente após <última tarefa cadastrada>", que
 * adivinhava a ligação pela ordem de cadastro — e ligava a tarefa a qualquer
 * coisa criada por último, mesmo de outra etapa.
 *
 * O lembrete saiu daqui: avisar que uma tarefa vai começar é acompanhamento de
 * execução, não planejamento.
 */
export function NovaTarefaDialog({
  obraId,
  etapaId,
  itensOrcamento,
  tarefasDaEtapa,
}: {
  obraId: string;
  etapaId: string;
  itensOrcamento: { id: string; descricao: string }[];
  /** Candidatas a predecessora: só as tarefas desta etapa. */
  tarefasDaEtapa: { id: string; nome: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [temPredecessora, setTemPredecessora] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  /*
   * A action é chamada direto, e não por `useActionState` + efeito que fecha o
   * diálogo quando `state.success` muda. Fechar dentro do próprio fluxo evita
   * o render em cascata que o efeito provoca — e é o padrão que o resto do
   * app já usa.
   */
  function salvar(formData: FormData) {
    setErro(null);

    // Mesma checagem do diálogo de edição: a mensagem precisa aparecer junto
    // do campo que falta, não voltar do servidor.
    if (temPredecessora && !formData.get("predecessora_id")) {
      return setErro("Selecione qual tarefa precede esta.");
    }
    if (!temPredecessora && !formData.get("restricao_inicio_nao_antes_de")) {
      return setErro("Sem predecessora, informe a data de início da tarefa.");
    }

    startTransition(async () => {
      const resultado = await criarTarefa(obraId, etapaId, { error: null }, formData);
      if (resultado.error) return setErro(resultado.error);
      setOpen(false);
      router.refresh();
    });
  }

  function handleOpenChange(proximo: boolean) {
    setOpen(proximo);
    if (proximo) {
      setTemPredecessora(false);
      setErro(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm">Nova tarefa</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
        </DialogHeader>
        <form action={salvar}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="nome">Nome da tarefa</FieldLabel>
              <Input id="nome" name="nome" placeholder="Escavação e sapatas" required />
            </Field>

            {!!tarefasDaEtapa.length && (
              <Field orientation="horizontal">
                <Checkbox
                  id="tem_predecessora"
                  name="tem_predecessora"
                  checked={temPredecessora}
                  onCheckedChange={(marcado) => {
                    setTemPredecessora(marcado === true);
                    setErro(null);
                  }}
                />
                <FieldContent>
                  <FieldLabel htmlFor="tem_predecessora">Essa tarefa tem predecessora</FieldLabel>
                  <FieldDescription>
                    Marque se ela só pode começar depois que outra tarefa desta etapa terminar.
                  </FieldDescription>
                </FieldContent>
              </Field>
            )}

            {temPredecessora && (
              <Field>
                <FieldLabel htmlFor="predecessora_id">Começa depois de</FieldLabel>
                <select
                  id="predecessora_id"
                  name="predecessora_id"
                  required
                  defaultValue=""
                  className={CLASSE_SELECT}
                >
                  <option value="" disabled>
                    Selecione a tarefa...
                  </option>
                  {tarefasDaEtapa.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </select>
                <FieldDescription>
                  O início é calculado a partir do fim dela — você não informa a data.
                </FieldDescription>
              </Field>
            )}

            {!temPredecessora && (
              <Field>
                <FieldLabel htmlFor="restricao_inicio_nao_antes_de">Início</FieldLabel>
                <Input
                  id="restricao_inicio_nao_antes_de"
                  name="restricao_inicio_nao_antes_de"
                  type="date"
                  required
                />
              </Field>
            )}

            {/* Duração digitada, fim calculado — ver a nota em
                `atualizarTarefa`. */}
            <Field>
              <FieldLabel htmlFor="duracao_dias">Duração (dias úteis)</FieldLabel>
              <Input
                id="duracao_dias"
                name="duracao_dias"
                type="number"
                min="1"
                step="1"
                defaultValue={1}
                required
                className="sm:max-w-32"
              />
              <FieldDescription>
                De segunda a sexta; sábados, domingos e folgas cadastradas não contam. O fim é
                calculado a partir daqui.
              </FieldDescription>
            </Field>

            {!!itensOrcamento.length && (
              <Field>
                <FieldLabel htmlFor="orcamento_item_id">Item do orçamento (opcional)</FieldLabel>
                <select id="orcamento_item_id" name="orcamento_item_id" className={CLASSE_SELECT}>
                  <option value="">Nenhum</option>
                  {itensOrcamento.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.descricao}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {erro && <FieldError>{erro}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? "Criando..." : "Criar tarefa"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
