"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil } from "lucide-react";
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
import { atualizarTarefa } from "@/app/actions/cronograma";

const CLASSE_SELECT = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

type Tarefa = {
  id: string;
  nome: string;
  duracao_dias: number;
  /** Datas calculadas pelo CPM — preenchem "Início" e "Fim previsto". */
  data_inicio_cedo: string | null;
  data_fim_cedo: string | null;
  restricao_inicio_nao_antes_de: string | null;
  data_inicio_real: string | null;
  data_fim_real: string | null;
};

/**
 * Edita a tarefa — planejamento, só.
 *
 * A predecessora deixou de ser uma lista com tipo de ligação e lag em dias.
 * Virou uma caixa ("tem predecessora") e um select com as tarefas da MESMA
 * etapa, sempre término → início. Tipo e lag eram campos que ninguém
 * preenchia, e davam ao cronograma cara de ferramenta de PERT que ele não
 * precisa ser.
 *
 * Fim real e lembrete saíram: conclusão se registra em Avanço, pelo percentual
 * da tarefa, e é de lá que sai a data real.
 */
export function EditarTarefaDialog({
  obraId,
  tarefa,
  tarefasDaEtapa,
  predecessoraAtualId,
  predecessoraAtualNome,
}: {
  obraId: string;
  tarefa: Tarefa;
  /** Candidatas a predecessora: as outras tarefas desta etapa. */
  tarefasDaEtapa: { id: string; nome: string }[];
  predecessoraAtualId: string | null;
  predecessoraAtualNome: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [temPredecessora, setTemPredecessora] = useState(!!predecessoraAtualId);
  /*
   * Início como estado, semeado com a data que a tarefa JÁ TEM.
   *
   * Tarefa encadeada não tem `restricao_inicio_nao_antes_de` — quem manda é a
   * predecessora. Ao desmarcar a caixa, o campo de início aparecia vazio e
   * obrigatório: o navegador barrava o envio sem explicar, e a mensagem de
   * erro da tentativa anterior continuava na tela dizendo "selecione a
   * predecessora". Parecia que o sistema não deixava remover o vínculo.
   *
   * Agora ele cai no início calculado, então desmarcar fixa a tarefa onde ela
   * já está, em vez de pedir uma data que o engenheiro não tem motivo para
   * escolher.
   */
  const [inicio, setInicio] = useState(
    tarefa.restricao_inicio_nao_antes_de ?? tarefa.data_inicio_cedo ?? ""
  );
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function salvar(formData: FormData) {
    setErro(null);

    /*
     * Confere aqui antes de chamar o servidor.
     *
     * A validação nativa (`required`) depende do navegador conseguir focar o
     * campo, e num diálogo em portal isso nem sempre acontece — o envio passa
     * e o erro volta do servidor, fora de contexto. Checando aqui, a mensagem
     * aparece ao lado do campo que falta.
     */
    if (temPredecessora && !formData.get("predecessora_id")) {
      return setErro("Selecione qual tarefa precede esta.");
    }
    if (!temPredecessora && !formData.get("restricao_inicio_nao_antes_de")) {
      return setErro("Sem predecessora, informe a data de início da tarefa.");
    }

    startTransition(async () => {
      const resultado = await atualizarTarefa(obraId, tarefa.id, { error: null }, formData);
      if (resultado.error) return setErro(resultado.error);
      setOpen(false);
      router.refresh();
    });
  }

  function handleOpenChange(proximo: boolean) {
    setOpen(proximo);
    // Reidrata ao abrir: o componente não remonta entre uma abertura e outra.
    if (proximo) {
      setTemPredecessora(!!predecessoraAtualId);
      setInicio(tarefa.restricao_inicio_nao_antes_de ?? tarefa.data_inicio_cedo ?? "");
      setErro(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Editar ${tarefa.nome}`}>
            <Pencil className="size-4" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tarefa.nome}</DialogTitle>
        </DialogHeader>
        <form action={salvar}>
          <FieldGroup>
            {!!tarefasDaEtapa.length && (
              <Field orientation="horizontal">
                <Checkbox
                  id="tem_predecessora"
                  name="tem_predecessora"
                  checked={temPredecessora}
                  onCheckedChange={(marcado) => {
                    const ligada = marcado === true;
                    setTemPredecessora(ligada);
                    // A mensagem da tentativa anterior deixa de valer no
                    // instante em que o formulário muda.
                    setErro(null);
                    if (!ligada && !inicio) setInicio(tarefa.data_inicio_cedo ?? "");
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
                  defaultValue={predecessoraAtualId ?? ""}
                  onChange={() => setErro(null)}
                  className={CLASSE_SELECT}
                >
                  <option value="" disabled>
                    Selecione a tarefa...
                  </option>
                  {/*
                    Predecessora de OUTRA etapa entra como opção própria.

                    Os templates encadeiam o fim de uma fase ao início da
                    seguinte — 31 ligações assim existem hoje. Sem esta opção o
                    select cairia no vazio e salvar romperia a ligação,
                    jogando todas as etapas para o dia 1 do cronograma.
                  */}
                  {predecessoraAtualId &&
                    !tarefasDaEtapa.some((t) => t.id === predecessoraAtualId) && (
                      <option value={predecessoraAtualId}>
                        {predecessoraAtualNome ?? "Tarefa"} (outra etapa)
                      </option>
                    )}
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
                  value={inicio}
                  onChange={(e) => {
                    setInicio(e.target.value);
                    setErro(null);
                  }}
                  required
                />
                <FieldDescription>
                  Sem predecessora, a tarefa é fixada nessa data.
                </FieldDescription>
              </Field>
            )}

            <Field>
              <FieldLabel htmlFor="data_fim_previsto">Fim previsto</FieldLabel>
              <Input
                id="data_fim_previsto"
                name="data_fim_previsto"
                type="date"
                defaultValue={tarefa.data_fim_cedo ?? ""}
                required
              />
              <FieldDescription>
                A duração atual é de {tarefa.duracao_dias}{" "}
                {tarefa.duracao_dias === 1 ? "dia útil" : "dias úteis"} e sai do intervalo entre
                início e fim.
              </FieldDescription>
            </Field>

            <FieldDescription>
              {tarefa.data_fim_real
                ? `Concluída em ${new Date(`${tarefa.data_fim_real}T00:00:00`).toLocaleDateString("pt-BR")}. A execução se registra em Avanço.`
                : "O que foi executado se registra em Avanço, pelo percentual da tarefa — aqui fica só o planejado."}
            </FieldDescription>

            {erro && <FieldError>{erro}</FieldError>}
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
