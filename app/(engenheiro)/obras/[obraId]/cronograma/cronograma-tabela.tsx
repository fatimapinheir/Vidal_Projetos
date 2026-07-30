import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { formatDateBR } from "@/lib/format-date";
import { Bell } from "lucide-react";
import { NovaTarefaDialog } from "./nova-tarefa-dialog";
import { EditarTarefaDialog } from "./editar-tarefa-dialog";
import { RemoverEtapaButton, RemoverTarefaButton } from "./cronograma-actions";
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

const tipoLabelCurto: Record<DependenciaTipo, string> = {
  termino_inicio: "TI",
  inicio_inicio: "II",
  termino_termino: "TT",
  inicio_termino: "IT",
};

function diasEntre(inicioIso: string, fimIso: string): number {
  const a = new Date(`${inicioIso}T00:00:00Z`).getTime();
  const b = new Date(`${fimIso}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

function subtrairDias(dataIso: string, dias: number): string {
  const data = new Date(`${dataIso}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() - dias);
  return data.toISOString().slice(0, 10);
}

export function CronogramaTabela({
  obraId,
  etapas,
  tarefas,
  dependencias,
  itensOrcamento,
  ultimaTarefaNome,
}: {
  obraId: string;
  etapas: Etapa[];
  tarefas: Tarefa[];
  dependencias: Dependencia[];
  itensOrcamento: { id: string; descricao: string }[];
  ultimaTarefaNome: string | null;
}) {
  const hojeIso = new Date().toISOString().slice(0, 10);

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
      {etapas.map((etapa) => {
        const tarefasDaEtapa = tarefasPorEtapa.get(etapa.id) ?? [];
        return (
          <div key={etapa.id} className="rounded-xl border">
            <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
              <p className="text-sm font-medium">{etapa.nome}</p>
              <div className="flex gap-2">
                <NovaTarefaDialog
                  obraId={obraId}
                  etapaId={etapa.id}
                  itensOrcamento={itensOrcamento}
                  ultimaTarefaNome={ultimaTarefaNome}
                />
                <RemoverEtapaButton obraId={obraId} etapaId={etapa.id} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarefa</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Predecessoras</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Fim</TableHead>
                    <TableHead>Margem</TableHead>
                    <TableHead>Real (início–fim)</TableHead>
                    <TableHead>Atraso</TableHead>
                    <TableHead>Lembrete</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tarefasDaEtapa.map((tarefa) => {
                    const deps = dependenciasPorSucessora.get(tarefa.id) ?? [];
                    const atraso =
                      tarefa.baseline_fim && tarefa.data_fim_cedo
                        ? diasEntre(tarefa.baseline_fim, tarefa.data_fim_real ?? tarefa.data_fim_cedo)
                        : null;
                    const outrasTarefas = tarefas
                      .filter((t) => t.id !== tarefa.id)
                      .map((t) => ({ id: t.id, nome: t.nome }));

                    const alertaEm =
                      tarefa.lembrete_dias_antes && tarefa.data_inicio_cedo
                        ? subtrairDias(tarefa.data_inicio_cedo, tarefa.lembrete_dias_antes)
                        : null;
                    const alertaAtivo = !!alertaEm && !tarefa.data_inicio_real && hojeIso >= alertaEm;

                    return (
                      <TableRow key={tarefa.id} className={tarefa.critica ? "bg-destructive/5" : ""}>
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
                                .map(
                                  (d) =>
                                    `${nomePorTarefaId.get(d.tarefa_predecessora_id) ?? "?"} (${tipoLabelCurto[d.tipo]}${d.lag_dias ? (d.lag_dias > 0 ? `+${d.lag_dias}` : d.lag_dias) : ""})`
                                )
                                .join(", ")
                            : "—"}
                        </TableCell>
                        <TableCell>{formatDateBR(tarefa.data_inicio_cedo)}</TableCell>
                        <TableCell>{formatDateBR(tarefa.data_fim_cedo)}</TableCell>
                        <TableCell>
                          {tarefa.folga_dias ?? "—"}
                          {tarefa.folga_dias !== null && "d"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {tarefa.data_inicio_real || tarefa.data_fim_real
                            ? `${formatDateBR(tarefa.data_inicio_real)} – ${formatDateBR(tarefa.data_fim_real)}`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {atraso === null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : atraso > 0 ? (
                            <span className="font-medium text-destructive">{atraso}d</span>
                          ) : (
                            <span className="text-muted-foreground">0d</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {alertaEm ? (
                            <span
                              className={
                                alertaAtivo
                                  ? "inline-flex items-center gap-1 font-medium text-atencao"
                                  : "inline-flex items-center gap-1 text-xs text-muted-foreground"
                              }
                            >
                              <Bell className="size-3.5" />
                              {formatDateBR(alertaEm)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <EditarTarefaDialog
                              obraId={obraId}
                              tarefa={tarefa}
                              outrasTarefas={outrasTarefas}
                              dependenciasAtuais={deps.map((d) => ({
                                id: d.id,
                                predecessoraNome: nomePorTarefaId.get(d.tarefa_predecessora_id) ?? "?",
                                tipo: d.tipo,
                                lagDias: d.lag_dias,
                              }))}
                            />
                            <RemoverTarefaButton obraId={obraId} tarefaId={tarefa.id} />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!tarefasDaEtapa.length && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground">
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
