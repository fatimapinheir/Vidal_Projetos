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
import { TemplateDialog } from "./template-dialog";
import { CriarRascunhoButton } from "./criar-rascunho-button";
import { CopiarDeOutraObraDialog } from "@/components/obras/copiar-de-outra-obra-dialog";
import { AtivarOrcamentoButton, DescartarRascunhoButton, RemoverItemButton } from "./rascunho-actions";
import { AdicionarItemNaEtapa, NovaEtapaButton, RemoverEtapaButton } from "@/components/orcamento/etapa-acoes";
import { EditarItemDialog } from "@/components/orcamento/editar-item-dialog";
import { ListaPorEtapa } from "@/components/orcamento/lista-por-etapa";
import { DashboardOrcamento } from "@/components/orcamento/dashboard-orcamento";
import { AjudaDaPagina } from "@/components/ui/ajuda-da-pagina";

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
  tipo_item: string | null;
};

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
      .select("id, titulo, mes_referencia, etapas")
      .eq("obra_id", obraId)
      .eq("status", "ativa")
      .maybeSingle(),
    supabase
      .from("orcamento_versoes")
      .select("id, titulo, created_at, etapas")
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
      <h1 className="flex items-center gap-1 font-heading text-lg font-semibold">
        Orçamento
        <AjudaDaPagina titulo="Orçamento">
          <p>
            Aqui você monta o orçamento planejado desta obra — escolha itens da tabela SINAPI ou
            cadastre itens avulsos, informando a quantidade que essa obra específica vai precisar.
          </p>
          <p>
            Depois de ativado, isso vira a meta comparada com o avanço físico e o gasto real nas
            ordens de compra.
          </p>
        </AjudaDaPagina>
      </h1>
    </div>
  );

  if (!versaoAtiva && !versaoRascunho) {
    return (
      <div className="flex flex-col items-start gap-4">
        {cabecalho}
        <div className="flex flex-wrap gap-2">
          <CriarRascunhoButton obraId={obraId} copiarDaAtiva={false} label="Montar item por item" />
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/obras/${obraId}/orcamento/upload`}>Importar planilha completa</Link>}
          />
          <CopiarDeOutraObraDialog
            obraId={obraId}
            padrao={{ orcamento: true, cronograma: false }}
          />
        </div>
        {!!versoesHistorico?.length && (
          <HistoricoRevisoes versoes={versoesHistorico} itensPorVersao={itensHistoricoPorVersao} />
        )}
      </div>
    );
  }

  const [
    { data: itensRascunho },
    { data: itensAtiva },
    { data: comprasVinculadas },
    { data: progresso },
    { data: obraCadastro },
  ] = await Promise.all([
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
      // Todas as compras da obra: é o "executado" desta tela. O avanço físico
      // não entra mais aqui — ele é medido por tarefa do cronograma, cuja EAP
      // é propositalmente outra.
      //
      // Sem etapa também entra. Filtrar por vínculo fazia o total ignorar
      // gasto real, e o lançamento que o cliente registra nasce justamente
      // sem etapa — ou seja, o buraco crescia sozinho.
      supabase
        .from("compras")
        .select("valor_total, status, orcamento_etapa")
        .eq("obra_id", obraId),
      versaoAtiva
        ? supabase.from("vw_progresso_obra").select("*").eq("obra_id", obraId).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("obras").select("metragem_quadrada").eq("id", obraId).maybeSingle(),
    ]);


  /**
   * Orçado × comprado por etapa do orçamento.
   *
   * "Comprado" conta ordem aprovada ou paga. Cotada fica fora: ainda é proposta
   * e pode ser recusada — somá-la mostraria estouro de etapa que talvez nunca
   * aconteça.
   */
  const COMPROMETIDAS = ["aprovada", "paga"];
  const compradoPorEtapa = new Map<string, number>();
  for (const compra of comprasVinculadas ?? []) {
    if (!COMPROMETIDAS.includes(compra.status)) continue;
    // Sem etapa vai para a linha "Sem etapa", a mesma dos itens do orçamento
    // sem etapa: entra no total e aparece no comparativo, em vez de sumir.
    const chave = compra.orcamento_etapa || "Sem etapa";
    compradoPorEtapa.set(chave, (compradoPorEtapa.get(chave) ?? 0) + compra.valor_total);
  }

  const orcadoPorEtapa = new Map<string, number>();
  for (const etapa of versaoAtiva?.etapas ?? []) orcadoPorEtapa.set(etapa, 0);
  for (const item of itensAtiva ?? []) {
    const chave = item.etapa || "Sem etapa";
    orcadoPorEtapa.set(chave, (orcadoPorEtapa.get(chave) ?? 0) + item.preco_total);
  }
  // Etapa que só aparece em compra (renomeada no orçamento, por exemplo) não
  // pode desaparecer do comparativo — senão o valor some sem explicação.
  for (const etapa of compradoPorEtapa.keys()) {
    if (!orcadoPorEtapa.has(etapa)) orcadoPorEtapa.set(etapa, 0);
  }

  const comparativo = [...orcadoPorEtapa.entries()].map(([etapa, orcado]) => {
    const comprado = compradoPorEtapa.get(etapa) ?? 0;
    return { etapa, orcado, comprado, saldo: orcado - comprado };
  });
  const totalOrcadoEtapas = comparativo.reduce((s, l) => s + l.orcado, 0);
  const totalComprado = comparativo.reduce((s, l) => s + l.comprado, 0);

  return (
    <div className="flex flex-col gap-4">
      {cabecalho}
      {versaoRascunho && (
        <Card className="border-primary/40">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">
              Rascunho em andamento{versaoRascunho.titulo ? ` — ${versaoRascunho.titulo}` : ""}
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <TemplateDialog
                obraId={obraId}
                versaoId={versaoRascunho.id}
                metragem={obraCadastro?.metragem_quadrada ?? null}
              />
              <DescartarRascunhoButton obraId={obraId} versaoId={versaoRascunho.id} />
              <AtivarOrcamentoButton obraId={obraId} versaoId={versaoRascunho.id} />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <NovaEtapaButton obraId={obraId} versaoId={versaoRascunho.id} />
              <p className="text-xs text-muted-foreground">
                Itens entram dentro de cada etapa, pelo botão &ldquo;Adicionar item&rdquo;.
              </p>
            </div>

            {(!!itensRascunho?.length || !!versaoRascunho.etapas.length) && (
              <ListaPorEtapa
                itens={itensRascunho ?? []}
                etapasDeclaradas={versaoRascunho.etapas}
                rotuloTotal="Total do rascunho"
                acoesItem={(item) => (
                  <>
                    <EditarItemDialog
                      obraId={obraId}
                      item={item}
                      etapas={versaoRascunho.etapas}
                    />
                    <RemoverItemButton obraId={obraId} itemId={item.id} />
                  </>
                )}
                acoesEtapa={(etapa, itens) =>
                  etapa !== "Sem etapa" && !itens.length ? (
                    <RemoverEtapaButton
                      obraId={obraId}
                      versaoId={versaoRascunho.id}
                      etapa={etapa}
                    />
                  ) : null
                }
                rodapeEtapa={(etapa) =>
                  etapa !== "Sem etapa" ? (
                    <AdicionarItemNaEtapa
                      obraId={obraId}
                      versaoId={versaoRascunho.id}
                      etapa={etapa}
                    />
                  ) : null
                }
              />
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
              Orçamento ativo
              {versaoAtiva.titulo
                ? ` — ${versaoAtiva.titulo}`
                : versaoAtiva.mes_referencia
                  ? ` — referência ${formatDateBR(versaoAtiva.mes_referencia)}`
                  : ""}
            </p>
            {!versaoRascunho && (
              <CriarRascunhoButton obraId={obraId} copiarDaAtiva label="Editar orçamento" />
            )}
          </div>

          {/* 1. O orçamento em si — é o que se vem ver. Mesmo layout do rascunho. */}
          <ListaPorEtapa
            itens={itensAtiva ?? []}
            etapasDeclaradas={versaoAtiva.etapas}
            rotuloTotal="Total do orçamento"
            destacarTotal
          />

          {/* 2. Para onde o dinheiro vai, depois da lista. */}
          <DashboardOrcamento
            itens={itensAtiva ?? []}
            metragem={obraCadastro?.metragem_quadrada ?? null}
          />

          {progresso && progresso.total_tarefas > 0 && (
            <Card>
              <CardContent className="flex flex-wrap items-baseline justify-between gap-2 py-4">
                <div>
                  <p className="text-sm text-muted-foreground">% físico executado</p>
                  <p className="font-heading text-2xl font-semibold">
                    {progresso.percentual_fisico.toFixed(1)}%
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {progresso.tarefas_concluidas} de {progresso.total_tarefas} tarefas do
                  cronograma ·{" "}
                  <Link
                    href={`/obras/${obraId}/avanco`}
                    className="text-primary-texto underline underline-offset-4"
                  >
                    registrar avanço
                  </Link>
                </p>
              </CardContent>
            </Card>
          )}

          {/*
            3. Orçado × comprado por etapa, por último.

            É acompanhamento de execução, não composição do orçamento: quem
            abre a tela quer primeiro saber quanto custa e onde pesa. O
            comparativo nasce do campo "etapa do orçamento" da ordem de compra
            — sem ele não há como saber a qual linha do orçamento um material
            pertence, e o estouro só apareceria no total da obra, quando já não
            há o que fazer.
          */}
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Orçado × comprado por etapa</CardTitle>
              <p className="text-sm text-muted-foreground">
                Comprado: <span className="font-medium text-foreground">{formatCurrency(totalComprado)}</span>{" "}
                de {formatCurrency(totalOrcadoEtapas)}
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Etapa</TableHead>
                      <TableHead className="text-right">Orçado</TableHead>
                      <TableHead className="text-right">Comprado</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead>%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparativo.map((linha) => {
                      const percentual =
                        linha.orcado > 0 ? (linha.comprado / linha.orcado) * 100 : 0;
                      const estourou = linha.saldo < 0;
                      return (
                        <TableRow key={linha.etapa}>
                          <TableCell className="max-w-64 truncate font-medium">
                            {linha.etapa}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(linha.orcado)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {linha.comprado > 0 ? formatCurrency(linha.comprado) : "—"}
                          </TableCell>
                          <TableCell
                            className={`text-right tabular-nums ${estourou ? "text-destructive" : ""}`}
                          >
                            {formatCurrency(linha.saldo)}
                          </TableCell>
                          <TableCell>
                            {linha.orcado > 0 ? (
                              <Badge variant={estourou ? "destructive" : "outline"}>
                                {percentual.toFixed(0)}%
                              </Badge>
                            ) : (
                              <Badge variant="atencao">Sem orçamento</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!comparativo.length && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Nenhuma etapa no orçamento ativo.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {!totalComprado && (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                  Nenhuma ordem de compra vinculada a etapa ainda. O vínculo se escolhe ao criar a
                  ordem, ou na tela da ordem já existente.
                </p>
              )}
            </CardContent>
          </Card>
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
        Versões anteriores do orçamento, substituídas quando uma nova revisão foi ativada.
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
