import { createClient } from "@/lib/supabase/server";
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
import {
  marcarFechamentoPago,
  marcarFechamentoEquipePago,
  marcarFechamentoEntregaPago,
} from "@/app/actions/fechamentos";
import { formatDateBR } from "@/lib/format-date";
import { AbrirFechamentoDialog } from "./abrir-fechamento-dialog";
import { MarcarPagoForm } from "./marcar-pago-form";
import { AbrirFechamentoEquipeDialog } from "./abrir-fechamento-equipe-dialog";
import { AbrirFechamentoEntregaDialog } from "./abrir-fechamento-entrega-dialog";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type LinhaEquipe = {
  id: string;
  periodo_inicio: string;
  periodo_fim: string;
  dias_trabalhados: number;
  valor_diaria: number;
  valor_total: number;
  status: string;
  equipe_id: string | null;
  trabalhadores: { nome: string } | null;
  equipes: { nome: string; responsavel: { nome: string } | null } | null;
};

export default async function FechamentosObraPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const supabase = await createClient();

  const [
    { data: fechamentosIndividuais },
    { data: alocados },
    { data: equipes },
    { data: fechamentosEquipeRaw },
    { data: fechamentosEntrega },
  ] = await Promise.all([
    supabase
      .from("fechamentos_periodo")
      .select("*, trabalhadores(nome)")
      .eq("obra_id", obraId)
      .is("equipe_id", null)
      .order("periodo_inicio", { ascending: false }),
    supabase
      .from("obra_trabalhadores")
      .select("trabalhador_id, trabalhadores(id, nome)")
      .eq("obra_id", obraId)
      .eq("ativo", true),
    supabase
      .from("obra_equipes")
      .select(
        "equipe_id, tipo_contrato, unidade_medida, valor_unidade, equipes(id, nome, responsavel:trabalhadores!responsavel_id(nome))"
      )
      .eq("obra_id", obraId)
      .eq("ativo", true),
    supabase
      .from("fechamentos_periodo")
      .select("*, trabalhadores(nome), equipes(nome, responsavel:trabalhadores!responsavel_id(nome))")
      .eq("obra_id", obraId)
      .not("equipe_id", "is", null)
      .order("periodo_inicio", { ascending: false }),
    supabase
      .from("fechamentos_entrega")
      .select("*, equipes(nome, responsavel:trabalhadores!responsavel_id(nome))")
      .eq("obra_id", obraId)
      .order("periodo_inicio", { ascending: false }),
  ]);

  const trabalhadores = (alocados ?? []).map(
    (a) => a.trabalhadores as unknown as { id: string; nome: string }
  );
  // Achata o vínculo de volta ao formato que as telas esperam: identidade da
  // equipe vem do cadastro, condições vêm do vínculo com esta obra.
  const equipesDaObra = (equipes ?? []).map((v) => {
    const eq = v.equipes as unknown as {
      id: string;
      nome: string;
      responsavel: { nome: string } | null;
    } | null;
    return {
      id: v.equipe_id,
      nome: eq?.nome ?? "—",
      responsavel: eq?.responsavel ?? null,
      tipo_contrato: v.tipo_contrato,
      unidade_medida: v.unidade_medida,
      valor_unidade: v.valor_unidade,
    };
  });

  const equipesDiaria = equipesDaObra.filter((eq) => eq.tipo_contrato === "diaria");
  const equipesEmpreitada = equipesDaObra.filter((eq) => eq.tipo_contrato === "empreitada");

  const grupos = new Map<
    string,
    {
      equipeId: string;
      equipeNome: string;
      responsavelNome: string;
      periodo_inicio: string;
      periodo_fim: string;
      linhas: LinhaEquipe[];
    }
  >();
  for (const raw of fechamentosEquipeRaw ?? []) {
    const f = raw as unknown as LinhaEquipe;
    const key = `${f.equipe_id}__${f.periodo_inicio}__${f.periodo_fim}`;
    if (!grupos.has(key)) {
      grupos.set(key, {
        equipeId: f.equipe_id!,
        equipeNome: f.equipes?.nome ?? "—",
        responsavelNome: f.equipes?.responsavel?.nome ?? "—",
        periodo_inicio: f.periodo_inicio,
        periodo_fim: f.periodo_fim,
        linhas: [],
      });
    }
    grupos.get(key)!.linhas.push(f);
  }
  const gruposEquipe = [...grupos.values()];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-base font-semibold">Fechamento individual</h2>
            <p className="text-sm text-muted-foreground">
              Fecha o pagamento de um trabalhador por vez (diária).
            </p>
          </div>
          <AbrirFechamentoDialog obraId={obraId} trabalhadores={trabalhadores} />
        </div>

        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trabalhador</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Dias</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fechamentosIndividuais?.map((f) => {
                const t = f.trabalhadores as unknown as { nome: string } | null;
                const marcarPago = marcarFechamentoPago.bind(null, obraId, f.id);
                return (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{t?.nome}</TableCell>
                    <TableCell>
                      {formatDateBR(f.periodo_inicio)} – {formatDateBR(f.periodo_fim)}
                    </TableCell>
                    <TableCell>{f.dias_trabalhados}</TableCell>
                    <TableCell>{formatCurrency(f.valor_total)}</TableCell>
                    <TableCell>
                      <Badge variant={f.status === "pago" ? "default" : "outline"}>
                        {f.status === "pago" ? "Pago" : "Aberto"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {f.status === "aberto" && (
                        <MarcarPagoForm prefixo={`${obraId}/${f.id}`} acao={marcarPago} />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!fechamentosIndividuais?.length && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhum fechamento individual aberto ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-base font-semibold">Fechamento por equipe (diária)</h2>
            <p className="text-sm text-muted-foreground">
              Fecha todos os membros da equipe de uma vez (mesma conta de dias × diária de cada um),
              pago ao responsável.
            </p>
          </div>
          <AbrirFechamentoEquipeDialog obraId={obraId} equipes={equipesDiaria} />
        </div>

        <div className="flex flex-col gap-3">
          {gruposEquipe.map((g) => {
            const total = g.linhas.reduce((sum, l) => sum + l.valor_total, 0);
            const status = g.linhas.every((l) => l.status === "pago") ? "pago" : "aberto";
            const marcarPago = marcarFechamentoEquipePago.bind(
              null,
              obraId,
              g.equipeId,
              g.periodo_inicio,
              g.periodo_fim
            );
            return (
              <div
                key={`${g.equipeId}-${g.periodo_inicio}-${g.periodo_fim}`}
                className="flex flex-col gap-2 rounded-xl border p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {g.equipeNome}{" "}
                      <Badge variant={status === "pago" ? "default" : "outline"} className="ml-1">
                        {status === "pago" ? "Pago" : "Aberto"}
                      </Badge>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateBR(g.periodo_inicio)} – {formatDateBR(g.periodo_fim)} · Responsável:{" "}
                      {g.responsavelNome}
                    </p>
                  </div>
                  <p className="font-medium">{formatCurrency(total)}</p>
                </div>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trabalhador</TableHead>
                        <TableHead>Dias</TableHead>
                        <TableHead>Diária</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {g.linhas.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell>{l.trabalhadores?.nome}</TableCell>
                          <TableCell>{l.dias_trabalhados}</TableCell>
                          <TableCell>{formatCurrency(l.valor_diaria)}</TableCell>
                          <TableCell>{formatCurrency(l.valor_total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {status === "aberto" && (
                  <MarcarPagoForm prefixo={`${obraId}/equipe-${g.equipeId}`} acao={marcarPago} />
                )}
              </div>
            );
          })}
          {!gruposEquipe.length && (
            <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
              Nenhum fechamento de equipe ainda.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-base font-semibold">Fechamento por entrega (empreitada)</h2>
            <p className="text-sm text-muted-foreground">
              Fecha pelo total entregue no período (ex: metragem), pago ao responsável da equipe.
            </p>
          </div>
          <AbrirFechamentoEntregaDialog obraId={obraId} equipes={equipesEmpreitada} />
        </div>

        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipe</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Entregue</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fechamentosEntrega?.map((f) => {
                const eq = f.equipes as unknown as {
                  nome: string;
                  responsavel: { nome: string } | null;
                } | null;
                const marcarPago = marcarFechamentoEntregaPago.bind(null, obraId, f.id);
                return (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{eq?.nome}</TableCell>
                    <TableCell>{eq?.responsavel?.nome ?? "—"}</TableCell>
                    <TableCell>
                      {formatDateBR(f.periodo_inicio)} – {formatDateBR(f.periodo_fim)}
                    </TableCell>
                    <TableCell>
                      {f.quantidade_entregue} {f.unidade_medida}
                    </TableCell>
                    <TableCell>{formatCurrency(f.valor_total)}</TableCell>
                    <TableCell>
                      <Badge variant={f.status === "pago" ? "default" : "outline"}>
                        {f.status === "pago" ? "Pago" : "Aberto"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {f.status === "aberto" && (
                        <MarcarPagoForm prefixo={`${obraId}/entrega-${f.id}`} acao={marcarPago} />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!fechamentosEntrega?.length && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Nenhum fechamento por entrega ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
