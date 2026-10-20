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
import {
  SeletorPredecessoras,
  type TarefaOpcao,
} from "@/components/cronograma/seletor-predecessoras";

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
  /** Marcada pelo engenheiro — não sai mais do CPM. Ver a migração 0065. */
  critica: boolean;
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
  tarefasDaObra,
  predecessorasAtuais,
}: {
  obraId: string;
  tarefa: Tarefa;
  /** Candidatas a predecessora: todas as tarefas da obra, menos esta. */
  tarefasDaObra: TarefaOpcao[];
  /** Ids das predecessoras que a tarefa tem hoje. Pode ser mais de uma. */
  predecessorasAtuais: string[];
}) {
  const [open, setOpen] = useState(false);
  const [temPredecessora, setTemPredecessora] = useState(!!predecessorasAtuais.length);
  const [predecessoras, setPredecessoras] = useState<string[]>(predecessorasAtuais);
  const [duracao, setDuracao] = useState(String(tarefa.duracao_dias));
  const [critica, setCritica] = useState(tarefa.critica);
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
    if (temPredecessora && !predecessoras.length) {
      return setErro("Selecione ao menos uma tarefa que precede esta.");
    }
    if (!Number(duracao) || Number(duracao) < 1) {
      return setErro("A duração precisa ser de pelo menos 1 dia útil.");
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
      setTemPredecessora(!!predecessorasAtuais.length);
      setPredecessoras(predecessorasAtuais);
      setDuracao(String(tarefa.duracao_dias));
      setCritica(tarefa.critica);
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
            {!!tarefasDaObra.length && (
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
                    Marque se ela só pode começar depois que outras terminarem.
                  </FieldDescription>
                </FieldContent>
              </Field>
            )}

            {temPredecessora && (
              <Field>
                <FieldLabel>Começa depois de</FieldLabel>
                {/*
                  Várias predecessoras, de qualquer etapa.
                  
                  Era um select de uma só, limitado à etapa. Salvar apagava as
                  demais em silêncio — quem abrisse a tarefa só para mudar a
                  duração perdia o encadeamento.
                */}
                <SeletorPredecessoras
                  name="predecessora_id"
                  tarefas={tarefasDaObra}
                  selecionadas={predecessoras}
                  aoMudar={(ids) => {
                    setPredecessoras(ids);
                    setErro(null);
                  }}
                />
                <FieldDescription>
                  O início sai da que terminar por último — você não informa a data.
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

            {/*
              A duração é o campo; o fim é consequência.
              
              Era o contrário: pedia-se o fim previsto e a duração saía da
              contagem de dias úteis entre início e fim. Com predecessora o
              início é calculado e nem aparece na tela — para dizer "isto leva
              10 dias" o engenheiro tinha de descobrir qual data final dava 10
              dias úteis a partir de um início que ele não via.
            */}
            <Field>
              <FieldLabel htmlFor="duracao_dias">Duração (dias úteis)</FieldLabel>
              <Input
                id="duracao_dias"
                name="duracao_dias"
                type="number"
                min="1"
                step="1"
                value={duracao}
                onChange={(e) => {
                  setDuracao(e.target.value);
                  setErro(null);
                }}
                required
                className="sm:max-w-32"
              />
              <FieldDescription>
                De segunda a sexta; sábados, domingos e folgas cadastradas não contam.
                {tarefa.data_fim_cedo && (
                  <>
                    {" "}
                    Hoje a tarefa termina em{" "}
                    {new Date(`${tarefa.data_fim_cedo}T00:00:00`).toLocaleDateString("pt-BR")} — o
                    fim é recalculado ao salvar.
                  </>
                )}
              </FieldDescription>
            </Field>

            {/*
              Crítica é marcada aqui, e a marca sobrevive ao recálculo.
              
              Antes era o CPM que escrevia essa coluna a cada salvamento
              (`folga <= 0`): dizer "esta é crítica" não existia, e o vermelho
              aparecia e desaparecia sozinho conforme as durações mudavam.
            */}
            <Field orientation="horizontal">
              <Checkbox
                id="critica"
                name="critica"
                checked={critica}
                onCheckedChange={(marcado) => {
                  setCritica(marcado === true);
                  setErro(null);
                }}
              />
              <FieldContent>
                <FieldLabel htmlFor="critica">Tarefa crítica</FieldLabel>
                <FieldDescription>
                  Atrasar essa tarefa atrasa a obra. Fica em vermelho no cronograma, no diário e no
                  avanço.
                </FieldDescription>
              </FieldContent>
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
