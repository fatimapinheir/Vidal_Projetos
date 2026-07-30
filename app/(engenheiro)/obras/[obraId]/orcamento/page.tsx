import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { formatDateBR } from "@/lib/format-date";
import { SinapiPicker } from "@/components/orcamento/sinapi-picker";
import { CriarRascunhoDialog } from "./criar-rascunho-dialog";
import { AtivarOrcamentoButton, DescartarRascunhoButton, RemoverItemButton } from "./rascunho-actions";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type ItemOrcamento = {
  id: string;
  codigo_sinapi: string | null;
  descricao: string;
  unidade: string;
  quantidade: number;
  preco_unitario: number;
  preco_total: number;
  etapa: string | null;
};

function agruparPorEtapa(itens: ItemOrcamento[]) {
  const grupos = new Map<string, ItemOrcamento[]>();
  for (const item of itens) {
    const chave = item.etapa || "Sem etapa";
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave)!.push(item);
  }
  return grupos;
}

export default async function OrcamentoObraPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const supabase = await createClient();

  const [{ data: versaoAtiva }, { data: versaoRascunho }, { data: versoesHistorico }] = await Promise.all([
    supabase
      .from("orcamento_versoes")
      .select("id, titulo, mes_referencia")
      .eq("obra_id", obraId)
      .eq("status", "ativa")
      .maybeSingle(),
    supabase
      .from("orcamento_versoes")
      .select("id, titulo, created_at")
      .eq("obra_id", obraId)
      .eq("status", "rascunho")
      .maybeSingle(),
    supabase
      .from("orcamento_versoes")
      .select("id, titulo, mes_referencia, created_at")
      .eq("obra_id", obraId)
      .eq("status", "substituida")
      .order("created_at", { ascending: false }),
  ]);

  const { data: itensHistorico } = versoesHistorico?.length
    ? await supabase
        .from("orcamento_itens")
        .select("*")
        .in(
          "orcamento_versao_id",
          versoesHistorico.map((v) => v.id)
        )
        .order("ordem")
    : { data: null };

  const itensHistoricoPorVersao = new Map<string, ItemOrcamento[]>();
  for (const item of itensHistorico ?? []) {
    const lista = itensHistoricoPorVersao.get(item.orcamento_versao_id) ?? [];
    lista.push(item);
    itensHistoricoPorVersao.set(item.orcamento_versao_id, lista);
  }

  const cabecalho = (
    <div>
      <h1 className="font-heading text-lg font-semibold">Planejamento</h1>
      <p className="text-sm text-muted-foreground">
        Aqui você monta o orçamento planejado desta obra — escolha itens da tabela SINAPI ou
        cadastre itens avulsos, informando a quantidade que essa obra específica vai precisar.
        Depois de ativado, isso vira a meta comparada com o avanço físico e o gasto real nas
        ordens de compra.
      </p>
    </div>
  );

  if (!versaoAtiva && !versaoRascunho) {
    return (
      <div className="flex flex-col items-start gap-4">
        {cabecalho}
        <div className="flex gap-2">
          <CriarRascunhoDialog obraId={obraId} temAtiva={false} label="Montar item por item" />
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/obras/${obraId}/orcamento/upload`}>Importar planilha completa</Link>}
          />
        </div>
        {!!versoesHistorico?.length && (
          <HistoricoRevisoes versoes={versoesHistorico} itensPorVersao={itensHistoricoPorVersao} />
        )}
      </div>
    );
  }

  const [{ data: itensRascunho }, { data: itensAtiva }, { data: avancos }, { data: progresso }] =
    await Promise.all([
      versaoRascunho
        ? supabase
            .from("orcamento_itens")
            .select("*")
            .eq("orcamento_versao_id", versaoRascunho.id)
            .order("ordem")
        : Promise.resolve({ data: null }),
      versaoAtiva
        ? supabase
            .from("orcamento_itens")
            .select("*")
            .eq("orcamento_versao_id", versaoAtiva.id)
            .order("ordem")
        : Promise.resolve({ data: null }),
      supabase.from("vw_avanco_atual").select("*").eq("obra_id", obraId),
      versaoAtiva
        ? supabase.from("vw_progresso_obra").select("*").eq("obra_id", obraId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const avancoPorItem = new Map(avancos?.map((a) => [a.orcamento_item_id, a]) ?? []);
  const totalRascunho = itensRascunho?.reduce((sum, i) => sum + i.preco_total, 0) ?? 0;

  return (
    <div className="flex flex-col gap-4">
      {cabecalho}
      {versaoRascunho && (
        <Card className="border-primary/40">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">
              Rascunho em andamento{versaoRascunho.titulo ? ` — ${versaoRascunho.titulo}` : ""}
            </CardTitle>
            <div className="flex gap-2">
              <DescartarRascunhoButton obraId={obraId} versaoId={versaoRascunho.id} />
              <AtivarOrcamentoButton obraId={obraId} versaoId={versaoRascunho.id} />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <SinapiPicker obraId={obraId} versaoId={versaoRascunho.id} />

            {!!itensRascunho?.length && (
              <div className="flex flex-col gap-4">
                {[...agruparPorEtapa(itensRascunho)].map(([etapa, itens]) => (
                  <div key={etapa} className="overflow-x-auto rounded-xl border">
                    <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
                      <p className="text-sm font-medium">{etapa}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(itens.reduce((sum, i) => sum + i.preco_total, 0))}
                      </p>
                    </div>
                    <Table>
                      <TableBody>
                        {itens.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-xs">{item.codigo_sinapi ?? "—"}</TableCell>
                            <TableCell className="max-w-64 truncate">{item.descricao}</TableCell>
                            <TableCell>{item.unidade}</TableCell>
                            <TableCell>{item.quantidade}</TableCell>
                            <TableCell>{formatCurrency(item.preco_unitario)}</TableCell>
                            <TableCell>{formatCurrency(item.preco_total)}</TableCell>
                            <TableCell className="text-right">
                              <RemoverItemButton obraId={obraId} itemId={item.id} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
                <p className="text-right text-sm font-medium">
                  Total do rascunho: {formatCurrency(totalRascunho)}
                </p>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              nativeButton={false}
              render={<Link href={`/obras/${obraId}/orcamento/upload`}>Importar planilha para este rascunho</Link>}
            />
          </CardContent>
        </Card>
      )}

      {versaoAtiva && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Planejamento ativo
              {versaoAtiva.titulo
                ? ` — ${versaoAtiva.titulo}`
                : versaoAtiva.mes_referencia
                  ? ` — referência ${formatDateBR(versaoAtiva.mes_referencia)}`
                  : ""}
            </p>
            {!versaoRascunho && (
              <CriarRascunhoDialog obraId={obraId} temAtiva label="Criar nova revisão" />
            )}
          </div>

          {progresso && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardContent className="py-4">
                  <p className="text-sm text-muted-foreground">Valor orçado total</p>
                  <p className="font-heading text-2xl font-semibold">
                    {formatCurrency(progresso.valor_orcado_total)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <p className="text-sm text-muted-foreground">% físico executado</p>
                  <p className="font-heading text-2xl font-semibold">
                    {progresso.percentual_fisico.toFixed(1)}%
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Un.</TableHead>
                  <TableHead>Qtd. orçada</TableHead>
                  <TableHead>Preço unit.</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Executado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itensAtiva?.map((item) => {
                  const avanco = avancoPorItem.get(item.id);
                  const percentual = avanco
                    ? Math.min((avanco.quantidade_executada_acumulada / item.quantidade) * 100, 100)
                    : 0;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs">{item.codigo_sinapi ?? "—"}</TableCell>
                      <TableCell className="max-w-64 truncate">{item.descricao}</TableCell>
                      <TableCell>
                        {item.etapa ? <Badge variant="outline">{item.etapa}</Badge> : "—"}
                      </TableCell>
                      <TableCell>{item.unidade}</TableCell>
                      <TableCell>{item.quantidade}</TableCell>
                      <TableCell>{formatCurrency(item.preco_unitario)}</TableCell>
                      <TableCell>{formatCurrency(item.preco_total)}</TableCell>
                      <TableCell>{percentual.toFixed(0)}%</TableCell>
                    </TableRow>
                  );
                })}
                {!itensAtiva?.length && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Nenhum item no planejamento.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {!!versoesHistorico?.length && (
        <HistoricoRevisoes versoes={versoesHistorico} itensPorVersao={itensHistoricoPorVersao} />
      )}
    </div>
  );
}

function HistoricoRevisoes({
  versoes,
  itensPorVersao,
}: {
  versoes: { id: string; titulo: string | null; mes_referencia: string | null; created_at: string }[];
  itensPorVersao: Map<string, ItemOrcamento[]>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-heading text-base font-semibold">Histórico de revisões</h2>
      <p className="text-sm text-muted-foreground">
        Versões anteriores do planejamento, substituídas quando uma nova revisão foi ativada.
        Ficam guardadas para consulta — não afetam mais os cálculos atuais.
      </p>
      <div className="flex flex-col gap-2">
        {versoes.map((versao) => {
          const itens = itensPorVersao.get(versao.id) ?? [];
          const total = itens.reduce((sum, i) => sum + i.preco_total, 0);
          return (
            <details key={versao.id} className="rounded-xl border">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm font-medium">
                <span>
                  {versao.titulo ||
                    (versao.mes_referencia ? `Referência ${formatDateBR(versao.mes_referencia)}` : "Sem título")}
                  <span className="ml-2 font-normal text-muted-foreground">
                    substituída em {formatDateBR(versao.created_at)}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  {itens.length} {itens.length === 1 ? "item" : "itens"} · {formatCurrency(total)}
                </span>
              </summary>
              <div className="overflow-x-auto border-t">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Etapa</TableHead>
                      <TableHead>Un.</TableHead>
                      <TableHead>Qtd.</TableHead>
                      <TableHead>Preço unit.</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itens.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-xs">{item.codigo_sinapi ?? "—"}</TableCell>
                        <TableCell className="max-w-64 truncate">{item.descricao}</TableCell>
                        <TableCell>
                          {item.etapa ? <Badge variant="outline">{item.etapa}</Badge> : "—"}
                        </TableCell>
                        <TableCell>{item.unidade}</TableCell>
                        <TableCell>{item.quantidade}</TableCell>
                        <TableCell>{formatCurrency(item.preco_unitario)}</TableCell>
                        <TableCell>{formatCurrency(item.preco_total)}</TableCell>
                      </TableRow>
                    ))}
                    {!itens.length && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          Nenhum item registrado nessa versão.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
