import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CardEstatistica } from "@/components/ui/card-estatistica";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HardHat, ClipboardCheck, AlertTriangle, Wallet } from "lucide-react";
import { formatDateBR } from "@/lib/format-date";
import { LembretesCard } from "@/components/lembretes/lembretes-card";
import { buscarLembretes } from "@/lib/lembretes";
import { formatarEndereco } from "@/lib/obra-cadastro";
import { ExcluirObraDialog } from "@/components/obras/excluir-obra-dialog";

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
    supabase
      .from("vw_compra_parcelas")
      .select("id")
      .eq("status_efetivo", "vencida")
      .eq("liberada_para_pagamento", true),
    supabase.from("compras").select("obra_id, valor_total, status").in("status", ["aprovada", "paga"]),
    supabase
      .from("vw_compra_parcelas")
      .select("data_vencimento, status_efetivo, compras!inner(obra_id)")
      .in("status_efetivo", ["pendente", "vencida"])
      .order("data_vencimento", { ascending: true }),
    buscarLembretes(supabase),
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
        <CardEstatistica
          rotulo="Obras em andamento"
          valor={obrasAtivas ?? 0}
          Icone={HardHat}
        />
        <CardEstatistica
          rotulo="Aguardando aprovação"
          valor={comprasPendentes ?? 0}
          descricao="Ordens de compra"
          Icone={ClipboardCheck}
        />
        <CardEstatistica
          rotulo="Parcelas vencidas"
          valor={parcelasVencidas?.length ?? 0}
          Icone={AlertTriangle}
          tom={parcelasVencidas?.length ? "alerta" : "neutro"}
        />
        <CardEstatistica
          rotulo="Gasto aprovado"
          valor={formatCurrency(gastoTotal)}
          descricao="Todas as obras"
          Icone={Wallet}
          tom="destaque"
        />
      </div>

      <LembretesCard
        lembretes={lembretes.lembretes}
        tarefasAtrasadas={lembretes.tarefasAtrasadas}
        mostrarObra
      />

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
              /*
                A linha era um <Link> envolvendo tudo, e botão dentro de link é
                HTML inválido — o clique no lixo abriria a obra. O link agora é
                uma camada esticada por cima do conteúdo estático, e a coluna da
                direita é posicionada para ficar acima dela: o nome continua
                clicável em toda a área, e o botão de excluir recebe o próprio
                clique.
              */
              <div
                key={obra.id}
                className="relative flex flex-col gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-muted sm:flex-row sm:items-center sm:justify-between"
              >
                <Link
                  href={`/obras/${obra.id}`}
                  aria-label={`Abrir ${obra.nome}`}
                  className="absolute inset-0 rounded-lg"
                />
                <div>
                  <p className="font-medium">{obra.nome}</p>
                  <p className="text-muted-foreground">{formatarEndereco(obra) ?? "Sem endereço"}</p>
                </div>
                <div className="relative flex flex-wrap items-center gap-3 sm:justify-end">
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
                  <ExcluirObraDialog obraId={obra.id} nome={obra.nome} />
                </div>
              </div>
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
