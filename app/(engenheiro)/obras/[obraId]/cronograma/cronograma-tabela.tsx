"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { formatDateBR } from "@/lib/format-date";
import { NovaTarefaDialog } from "./nova-tarefa-dialog";
import { EditarTarefaDialog } from "./editar-tarefa-dialog";
import { RemoverEtapaButton, RemoverTarefaButton } from "./cronograma-actions";
import { removerTarefas } from "@/app/actions/cronograma";
import type { DependenciaTipo, Tables } from "@/lib/types/database.types";

type Tarefa = Tables<"cronograma_tarefas">;
type Etapa = Tables<"cronograma_etapas">;
type Dependencia = {
  id: string;
  tarefa_predecessora_id: string;
  tarefa_sucessora_id: string;
  tipo: DependenciaTipo;
  lag_dias: number;
};

/*
 * O cronograma mostra só o PLANEJADO.
 *
 * Margem, real (início–fim), atraso e lembrete saíram desta tabela: real e
 * atraso são execução, e execução se registra e se lê em Avanço. Misturar as
 * duas coisas numa tabela só foi o que confundiu as definições — cronograma é
 * o que se planeja, avanço é o que aconteceu.
 */
export function CronogramaTabela({
  obraId,
  etapas,
  tarefas,
  dependencias,
  itensOrcamento,
}: {
  obraId: string;
  etapas: Etapa[];
  tarefas: Tarefa[];
  dependencias: Dependencia[];
  itensOrcamento: { id: string; descricao: string }[];
}) {
  /*
   * Seleção para exclusão em lote.
   *
   * O template entrega 130 tarefas e boa parte não se aplica à obra; apagar
   * uma a uma, com confirmação e recálculo a cada clique, inviabiliza a
   * limpeza. A seleção atravessa etapas de propósito — quem está limpando
   * cronograma não limpa uma frente de serviço por vez.
   */
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [removendo, iniciarRemocao] = useTransition();
  const router = useRouter();

  function alternar(id: string) {
    setSelecionadas((atual) => {
      const proxima = new Set(atual);
      if (proxima.has(id)) proxima.delete(id);
      else proxima.add(id);
      return proxima;
    });
  }

  function alternarEtapa(ids: string[], marcar: boolean) {
    setSelecionadas((atual) => {
      const proxima = new Set(atual);
      for (const id of ids) {
        if (marcar) proxima.add(id);
        else proxima.delete(id);
      }
      return proxima;
    });
  }

  function removerSelecionadas() {
    const ids = [...selecionadas];
    if (!ids.length) return;
    if (
      !confirm(
        `Remover ${ids.length} ${ids.length === 1 ? "tarefa" : "tarefas"}? As tarefas que dependiam delas são religadas à predecessora anterior, para o cronograma não se desmontar.`
      )
    )
      return;

    iniciarRemocao(async () => {
      const resultado = await removerTarefas(obraId, ids);
      if (resultado.error) alert(resultado.error);
      setSelecionadas(new Set());
      router.refresh();
    });
  }

  const nomePorTarefaId = new Map(tarefas.map((t) => [t.id, t.nome]));

  const dependenciasPorSucessora = new Map<string, Dependencia[]>();
  for (const dep of dependencias) {
    const lista = dependenciasPorSucessora.get(dep.tarefa_sucessora_id) ?? [];
    lista.push(dep);
    dependenciasPorSucessora.set(dep.tarefa_sucessora_id, lista);
  }

  const tarefasPorEtapa = new Map<string, Tarefa[]>();
  for (const t of tarefas) {
    const lista = tarefasPorEtapa.get(t.etapa_id) ?? [];
    lista.push(t);
    tarefasPorEtapa.set(t.etapa_id, lista);
  }

  if (!etapas.length) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nenhuma etapa criada ainda. Comece criando uma etapa (ex: Fundação, Alvenaria...).
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {!!selecionadas.size && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-card p-3 shadow-sm">
          <p className="text-sm">
            <span className="font-medium">{selecionadas.size}</span>{" "}
            {selecionadas.size === 1 ? "tarefa selecionada" : "tarefas selecionadas"}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setSelecionadas(new Set())}
              disabled={removendo}
            >
              Limpar seleção
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={removerSelecionadas}
              disabled={removendo}
            >
              <Trash2 className="size-4" />
              {removendo ? "Removendo..." : `Remover ${selecionadas.size}`}
            </Button>
          </div>
        </div>
      )}

      {etapas.map((etapa) => {
        const tarefasDaEtapa = tarefasPorEtapa.get(etapa.id) ?? [];
        const idsDaEtapa = tarefasDaEtapa.map((t) => t.id);
        const todasMarcadas = !!idsDaEtapa.length && idsDaEtapa.every((id) => selecionadas.has(id));
        return (
          <div key={etapa.id} className="rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                {!!idsDaEtapa.length && (
                  <input
                    type="checkbox"
                    checked={todasMarcadas}
                    onChange={(e) => alternarEtapa(idsDaEtapa, e.target.checked)}
                    aria-label={`Selecionar todas as tarefas de ${etapa.nome}`}
                  />
                )}
                {etapa.nome}
              </label>
              <div className="flex gap-2">
                <NovaTarefaDialog
                  obraId={obraId}
                  etapaId={etapa.id}
                  itensOrcamento={itensOrcamento}
                  tarefasDaEtapa={tarefasDaEtapa.map((t) => ({ id: t.id, nome: t.nome }))}
                />
                <RemoverEtapaButton obraId={obraId} etapaId={etapa.id} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Tarefa</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Predecessora</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Fim</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tarefasDaEtapa.map((tarefa) => {
                    const deps = dependenciasPorSucessora.get(tarefa.id) ?? [];
                    // Só tarefas DESTA etapa podem ser predecessoras: a
                    // dependência que o engenheiro monta é dentro da frente de
                    // serviço que ele está editando.
                    const tarefasDaMesmaEtapa = tarefasDaEtapa
                      .filter((t) => t.id !== tarefa.id)
                      .map((t) => ({ id: t.id, nome: t.nome }));

                    return (
                      <TableRow
                        key={tarefa.id}
                        className={
                          selecionadas.has(tarefa.id)
                            ? "bg-primary/5"
                            : tarefa.critica
                              ? "bg-destructive/5"
                              : ""
                        }
                      >
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selecionadas.has(tarefa.id)}
                            onChange={() => alternar(tarefa.id)}
                            aria-label={`Selecionar ${tarefa.nome}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {tarefa.nome}
                          {tarefa.critica && (
                            <Badge variant="destructive" className="ml-2">
                              Crítica
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{tarefa.duracao_dias}d</TableCell>
                        <TableCell className="text-xs">
                          {deps.length
                            ? deps
                                .map((d) => nomePorTarefaId.get(d.tarefa_predecessora_id) ?? "?")
                                .join(", ")
                            : "—"}
                        </TableCell>
                        <TableCell>{formatDateBR(tarefa.data_inicio_cedo)}</TableCell>
                        <TableCell>{formatDateBR(tarefa.data_fim_cedo)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <EditarTarefaDialog
                              obraId={obraId}
                              tarefa={tarefa}
                              tarefasDaEtapa={tarefasDaMesmaEtapa}
                              predecessoraAtualId={deps[0]?.tarefa_predecessora_id ?? null}
                              predecessoraAtualNome={
                                deps[0]
                                  ? nomePorTarefaId.get(deps[0].tarefa_predecessora_id) ?? null
                                  : null
                              }
                            />
                            <RemoverTarefaButton obraId={obraId} tarefaId={tarefa.id} />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!tarefasDaEtapa.length && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Nenhuma tarefa nessa etapa ainda.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
