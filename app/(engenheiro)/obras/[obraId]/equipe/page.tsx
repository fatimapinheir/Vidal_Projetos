import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { AlocarTrabalhadorDialog } from "./alocar-trabalhador-dialog";
import { NovaEquipeDialog } from "./nova-equipe-dialog";
import { DesativarEquipeButton } from "./equipe-actions";

export default async function EquipeObraPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const supabase = await createClient();

  const [{ data: alocados }, { data: todosTrabalhadores }, { data: equipes }] = await Promise.all([
    supabase
      .from("obra_trabalhadores")
      .select("trabalhador_id, valor_diaria, ativo, trabalhadores(nome, funcao, telefone)")
      .eq("obra_id", obraId)
      .eq("ativo", true),
    supabase.from("trabalhadores").select("id, nome, funcao, valor_diaria_padrao").eq("ativo", true),
    supabase
      .from("equipes")
      .select(
        "id, nome, tipo_contrato, unidade_medida, valor_unidade, responsavel:trabalhadores!responsavel_id(nome), equipe_trabalhadores(trabalhador_id, trabalhadores(nome))"
      )
      .eq("obra_id", obraId)
      .eq("ativo", true),
  ]);

  const alocadosIds = new Set(alocados?.map((a) => a.trabalhador_id));
  const disponiveis = (todosTrabalhadores ?? []).filter((t) => !alocadosIds.has(t.id));

  const trabalhadoresAlocados = (alocados ?? []).map((a) => {
    const t = a.trabalhadores as unknown as { nome: string; funcao: string | null } | null;
    return { id: a.trabalhador_id, nome: t?.nome ?? "—", funcao: t?.funcao ?? null };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Trabalhadores alocados nessa obra e suas diárias.
          </p>
          <AlocarTrabalhadorDialog obraId={obraId} trabalhadoresDisponiveis={disponiveis} />
        </div>

        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Diária nessa obra</TableHead>
                <TableHead>Telefone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alocados?.map((a) => {
                const t = a.trabalhadores as unknown as {
                  nome: string;
                  funcao: string | null;
                  telefone: string | null;
                } | null;
                return (
                  <TableRow key={a.trabalhador_id}>
                    <TableCell className="font-medium">{t?.nome}</TableCell>
                    <TableCell>{t?.funcao ?? "—"}</TableCell>
                    <TableCell>
                      {a.valor_diaria.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </TableCell>
                    <TableCell>{t?.telefone ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
              {!alocados?.length && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Nenhum trabalhador alocado ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-base font-semibold">Equipes</h2>
            <p className="text-sm text-muted-foreground">
              Agrupe trabalhadores para fechar pagamento em lote (diária) ou por entrega (empreitada).
            </p>
          </div>
          <NovaEquipeDialog obraId={obraId} trabalhadoresAlocados={trabalhadoresAlocados} />
        </div>

        <div className="flex flex-col gap-3">
          {equipes?.map((eq) => {
            const responsavel = eq.responsavel as unknown as { nome: string } | null;
            const membros = (eq.equipe_trabalhadores ?? []) as unknown as {
              trabalhador_id: string;
              trabalhadores: { nome: string } | null;
            }[];
            return (
              <div key={eq.id} className="rounded-xl border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {eq.nome}{" "}
                      <Badge variant="outline" className="ml-1">
                        {eq.tipo_contrato === "diaria"
                          ? "Diária"
                          : `Empreitada — ${eq.unidade_medida} a ${(eq.valor_unidade ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
                      </Badge>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Responsável: {responsavel?.nome ?? "—"} · Membros:{" "}
                      {membros.map((m) => m.trabalhadores?.nome).filter(Boolean).join(", ") || "—"}
                    </p>
                  </div>
                  <DesativarEquipeButton obraId={obraId} equipeId={eq.id} />
                </div>
              </div>
            );
          })}
          {!equipes?.length && (
            <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
              Nenhuma equipe criada ainda.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
