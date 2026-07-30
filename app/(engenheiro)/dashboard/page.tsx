import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateBR } from "@/lib/format-date";
import { LembretesCard } from "@/components/cronograma/lembretes-card";
import { buscarLembretesAtivos } from "@/lib/cronograma/lembretes";

const statusLabel: Record<string, string> = {
  planejamento: "Planejamento",
  em_andamento: "Em andamento",
  pausada: "Pausada",
  concluida: "Concluída",
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function EngenheiroDashboardPage() {
  const supabase = await createClient();

  const [
    { data: obras },
    { count: obrasAtivas },
    { count: comprasPendentes },
    { data: parcelasVencidas },
    { data: comprasPorObra },
    { data: parcelasEmAberto },
    lembretes,
  ] = await Promise.all([
    supabase.from("obras").select("*").order("created_at", { ascending: false }),
    supabase.from("obras").select("*", { count: "exact", head: true }).eq("status", "em_andamento"),
    supabase.from("compras").select("*", { count: "exact", head: true }).eq("status", "cotada"),
    supabase.from("vw_compra_parcelas").select("id").eq("status_efetivo", "vencida"),
    supabase.from("compras").select("obra_id, valor_total, status").in("status", ["aprovada", "paga"]),
    supabase
      .from("vw_compra_parcelas")
      .select("data_vencimento, status_efetivo, compras!inner(obra_id)")
      .in("status_efetivo", ["pendente", "vencida"])
      .order("data_vencimento", { ascending: true }),
    buscarLembretesAtivos(supabase),
  ]);

  const gastoPorObra = new Map<string, number>();
  for (const c of comprasPorObra ?? []) {
    gastoPorObra.set(c.obra_id, (gastoPorObra.get(c.obra_id) ?? 0) + c.valor_total);
  }

  const proximaParcelaPorObra = new Map<string, { data_vencimento: string; vencida: boolean }>();
  for (const p of parcelasEmAberto ?? []) {
    const compra = p.compras as unknown as { obra_id: string } | null;
    if (!compra || proximaParcelaPorObra.has(compra.obra_id)) continue;
    proximaParcelaPorObra.set(compra.obra_id, {
      data_vencimento: p.data_vencimento,
      vencida: p.status_efetivo === "vencida",
    });
  }

  const gastoTotal = [...gastoPorObra.values()].reduce((sum, v) => sum + v, 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-lg font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral de todas as obras.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Obras em andamento</p>
            <p className="font-heading text-2xl font-semibold">{obrasAtivas ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Ordens de compra aguardando aprovação</p>
            <p className="font-heading text-2xl font-semibold">{comprasPendentes ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Parcelas vencidas</p>
            <p className="font-heading text-2xl font-semibold text-destructive">
              {parcelasVencidas?.length ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Gasto aprovado (todas as obras)</p>
            <p className="font-heading text-2xl font-semibold">{formatCurrency(gastoTotal)}</p>
          </CardContent>
        </Card>
      </div>

      <LembretesCard lembretes={lembretes} mostrarObra />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Obras</CardTitle>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/obras/novo">Nova obra</Link>}
          />
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {obras?.map((obra) => {
            const proxima = proximaParcelaPorObra.get(obra.id);
            return (
              <Link
                key={obra.id}
                href={`/obras/${obra.id}`}
                className="flex flex-col gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-muted sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{obra.nome}</p>
                  <p className="text-muted-foreground">{obra.endereco ?? "Sem endereço"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                  <span className="text-muted-foreground">
                    Gasto: <span className="font-medium text-foreground">{formatCurrency(gastoPorObra.get(obra.id) ?? 0)}</span>
                  </span>
                  {proxima && (
                    <Badge variant={proxima.vencida ? "destructive" : "outline"}>
                      Parcela {proxima.vencida ? "vencida" : "em"}{" "}
                      {formatDateBR(proxima.data_vencimento)}
                    </Badge>
                  )}
                  <Badge variant="secondary">{statusLabel[obra.status]}</Badge>
                </div>
              </Link>
            );
          })}
          {!obras?.length && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma obra cadastrada ainda.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
