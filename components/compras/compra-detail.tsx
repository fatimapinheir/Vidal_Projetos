import { createClient } from "@/lib/supabase/server";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { CompraStatusBadge } from "./status-badges";
import { SituacaoFinanceiraBadge, SituacaoEntregaBadge } from "./situacao-badges";
import { situacaoFinanceiraParcela, situacaoEntregaOrdem } from "@/lib/compras/situacao";
import { PagarParcelaForm } from "./pagar-parcela-form";
import { RecebimentoOrdem } from "./recebimento-ordem";
import { PagamentoEnviadoParcela } from "./pagamento-enviado-parcela";
import { CompraAprovacaoActions } from "./compra-aprovacao-actions";
import { EtapaOrcamentoSelect } from "./etapa-orcamento-select";
import { formatDateBR as formatDate } from "@/lib/format-date";
import { getProfile } from "@/lib/auth/get-profile";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export async function CompraDetail({
  compraId,
  viewerRole,
}: {
  compraId: string;
  viewerRole: "engenheiro" | "cliente";
}) {
  const supabase = await createClient();
  const profile = await getProfile();

  const { data: compra } = await supabase
    .from("compras")
    .select("*, fornecedores(nome)")
    .eq("id", compraId)
    .single();

  if (!compra) return <p className="text-sm text-muted-foreground">Compra não encontrada.</p>;

  const { data: parcelas } = await supabase
    .from("vw_compra_parcelas")
    .select("*")
    .eq("compra_id", compraId)
    .order("numero_parcela");

  const { data: itens } = await supabase
    .from("compra_itens")
    .select("*")
    .eq("compra_id", compraId)
    .order("ordem");

  // Etapas do orçamento ativo, para o vínculo desta ordem. Só o engenheiro
  // escolhe, mas o cliente vê a etapa já vinculada.
  const { data: versaoAtiva } =
    viewerRole === "engenheiro"
      ? await supabase
          .from("orcamento_versoes")
          .select("id, etapas")
          .eq("obra_id", compra.obra_id)
          .eq("status", "ativa")
          .maybeSingle()
      : { data: null };

  const { data: etapasEmItens } = versaoAtiva
    ? await supabase
        .from("orcamento_itens")
        .select("etapa")
        .eq("orcamento_versao_id", versaoAtiva.id)
        .not("etapa", "is", null)
    : { data: null };

  const etapasOrcamento = [
    ...new Set([
      ...(versaoAtiva?.etapas ?? []),
      ...(etapasEmItens ?? []).map((i) => i.etapa).filter((e): e is string => !!e),
    ]),
  ];

  const subtotalItens = itens?.reduce((sum, item) => sum + item.total_liquido, 0) ?? 0;

  const fornecedor = compra.fornecedores as unknown as { nome: string } | null;

  /*
   * Anexos: a tabela nova (até três arquivos) mais o caminho único antigo.
   *
   * O `anexo_cotacao_path` ficou obsoleto em 0048 e ninguém mais escreve
   * nele, mas linha gravada antes disso continua apontando para um arquivo
   * real — ignorá-lo faria o anexo desaparecer da tela sem ter sido apagado.
   */
  const { data: anexos } = await supabase
    .from("compra_anexos")
    .select("id, bucket, path, nome")
    .eq("compra_id", compraId)
    .order("created_at");

  const anexosParaMostrar = [
    ...(anexos ?? []),
    ...(compra.anexo_cotacao_path
      ? [
          {
            id: "legado",
            bucket: "cotacoes" as const,
            path: compra.anexo_cotacao_path,
            nome: "Anexo da cotação",
          },
        ]
      : []),
  ];

  const anexosComUrl = await Promise.all(
    anexosParaMostrar.map(async (anexo) => {
      const { data } = await supabase.storage
        .from(anexo.bucket)
        .createSignedUrl(anexo.path, 60 * 10);
      return { ...anexo, url: data?.signedUrl ?? null };
    })
  );

  const comprovantesUrls = new Map<string, string>();
  for (const p of parcelas ?? []) {
    if (p.comprovante_pagamento_path) {
      const { data } = await supabase.storage
        .from("comprovantes-pagamento")
        .createSignedUrl(p.comprovante_pagamento_path, 60 * 10);
      if (data?.signedUrl) comprovantesUrls.set(p.id, data.signedUrl);
    }
  }

  const parcelaUnica = parcelas?.length === 1 ? parcelas[0] : undefined;

  /*
   * Quem pode dizer que a mercadoria chegou.
   *
   * Engenheiro: em qualquer compra que prometeu entrega, e nas "pagar após o
   * recebimento" mesmo sem previsão — lá é o botão que destrava as parcelas.
   *
   * Cliente: só no lançamento que ele mesmo registrou. Ele pagou e recebeu;
   * depender do engenheiro para fechar a entrega de um gasto que o engenheiro
   * nem viu passar deixaria a previsão parada para sempre. É só a tela — quem
   * recusa de verdade é `cli_marcar_entrega_lancamento` (0049).
   */
  const podeMarcarEntrega =
    viewerRole === "engenheiro"
      ? compra.pagamento_apos_recebimento ||
        !!compra.data_entrega_prevista ||
        // Já recebida também mostra o botão, senão o lançamento criado com
        // "já recebi" e sem previsão nasceria sem como desfazer.
        !!compra.data_entrega_real
      : compra.eh_lancamento && !!profile && compra.criado_por === profile.id;


  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle>{compra.descricao}</CardTitle>
            <p className="text-sm text-muted-foreground">{fornecedor?.nome}</p>
          </div>
          <CompraStatusBadge status={compra.status} />
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div>
              <p className="text-muted-foreground">Valor total</p>
              <p className="font-medium">{formatCurrency(compra.valor_total)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Forma de pagamento</p>
              <p className="font-medium capitalize">{compra.forma_pagamento.replace("_", " ")}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Cotada em</p>
              <p className="font-medium">{formatDate(compra.data_cotacao)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Etapa do orçamento</p>
              {viewerRole === "engenheiro" ? (
                <EtapaOrcamentoSelect
                  compraId={compra.id}
                  etapaAtual={compra.orcamento_etapa}
                  etapas={etapasOrcamento}
                />
              ) : (
                <p className="font-medium">{compra.orcamento_etapa ?? "—"}</p>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground">Anexos</p>
              {anexosComUrl.length ? (
                <ul className="flex flex-col">
                  {anexosComUrl.map((anexo) => (
                    <li key={anexo.id} className="min-w-0 truncate" title={anexo.nome}>
                      {anexo.url ? (
                        <a
                          href={anexo.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-primary-texto underline underline-offset-4"
                        >
                          {anexo.nome}
                        </a>
                      ) : (
                        <span className="font-medium">{anexo.nome}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="font-medium">—</p>
              )}
            </div>
          </div>

          {compra.status === "recusada" && compra.motivo_recusa && (
            <p className="rounded-lg bg-destructive/10 p-3 text-destructive">
              Motivo da recusa: {compra.motivo_recusa}
            </p>
          )}

          {viewerRole === "cliente" && compra.status === "cotada" && (
            <CompraAprovacaoActions
              obraId={compra.obra_id}
              compraId={compra.id}
              parcelaUnicaId={parcelaUnica?.id}
            />
          )}
          {viewerRole === "engenheiro" && compra.status === "cotada" && (
            <p className="text-sm text-muted-foreground">Aguardando aprovação do cliente.</p>
          )}
          {compra.pagamento_apos_recebimento && (
            <p className="rounded-lg border border-atencao/40 bg-atencao/10 p-3 text-sm">
              O pagamento desta ordem depende do recebimento da mercadoria. Cada parcela só entra
              na lista de pagamentos depois que o recebimento for confirmado.
            </p>
          )}
          {!compra.requer_aprovacao_cliente && compra.status === "aprovada" && (
            <p className="text-sm text-muted-foreground">
              Liberada automaticamente — essa ordem não exigiu aprovação do cliente.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Itens</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Un.</TableHead>
                  <TableHead>Qtd.</TableHead>
                  <TableHead>Preço unit.</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead>Total líquido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="max-w-64 truncate">{item.descricao}</TableCell>
                    <TableCell>{item.unidade}</TableCell>
                    <TableCell>{item.quantidade}</TableCell>
                    <TableCell>{formatCurrency(item.preco_unitario)}</TableCell>
                    <TableCell className="text-xs">
                      {item.desconto_tipo === "percentual"
                        ? `${item.desconto_valor}%`
                        : item.desconto_tipo === "valor"
                          ? formatCurrency(item.desconto_valor ?? 0)
                          : "—"}
                    </TableCell>
                    <TableCell>{formatCurrency(item.total_liquido)}</TableCell>
                  </TableRow>
                ))}
                {!itens?.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Nenhum item registrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-1 px-4 pb-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal dos itens</span>
              <span>{formatCurrency(subtotalItens)}</span>
            </div>
            {compra.desconto_tipo && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Desconto da nota ({compra.desconto_tipo === "percentual" ? `${compra.desconto_valor}%` : formatCurrency(compra.desconto_valor ?? 0)})
                </span>
                <span>-{formatCurrency(subtotalItens - compra.valor_total)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium">
              <span>Total da ordem de compra</span>
              <span>{formatCurrency(compra.valor_total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parcelas</CardTitle>
          {/*
            A entrega mora aqui, no cabeçalho, e não em cada linha: ela é da
            ordem. Com "pagar após o recebimento", é este botão que libera
            TODAS as parcelas de uma vez — antes dele nenhuma vence.
          */}
          <CardAction>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Entrega</p>
                <SituacaoEntregaBadge
                  situacao={situacaoEntregaOrdem(
                    compra.data_entrega_prevista,
                    compra.data_entrega_real
                  )}
                  simplificado={viewerRole === "cliente"}
                />
              </div>
              {/*
                Confirmar recebimento aparece em toda compra que prometeu uma
                entrega, não só nas "pagar após o recebimento".

                Antes só aparecia nestas últimas, porque lá o botão libera as
                parcelas. Mas a previsão existe nas outras também — e agora nos
                lançamentos —, e sem botão nenhum ela ficava eternamente
                "prevista" ou "atrasada", sem ninguém poder dizer que chegou.
              */}
              {podeMarcarEntrega && (
                <RecebimentoOrdem
                  compraId={compra.id}
                  recebidoEm={compra.data_entrega_real}
                  liberaPagamento={compra.pagamento_apos_recebimento}
                />
              )}
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Financeiro</TableHead>
                  <TableHead>Comprovante</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {parcelas?.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.numero_parcela}</TableCell>
                    <TableCell>{formatCurrency(p.valor)}</TableCell>
                    <TableCell>{formatDate(p.data_vencimento)}</TableCell>
                    <TableCell>
                      <SituacaoFinanceiraBadge
                        situacao={situacaoFinanceiraParcela(p)}
                        simplificado={viewerRole === "cliente"}
                      />
                    </TableCell>
                    <TableCell>
                      {comprovantesUrls.has(p.id) ? (
                        <a
                          href={comprovantesUrls.get(p.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary-texto underline underline-offset-4"
                        >
                          Ver
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {/* O passo do meio: liberada, lançada, depois paga. */}
                        {viewerRole === "engenheiro" &&
                          p.status !== "paga" &&
                          p.liberada_para_pagamento && (
                            <PagamentoEnviadoParcela
                              compraId={compra.id}
                              parcelaId={p.id}
                              enviadoEm={p.pagamento_enviado_em}
                            />
                          )}
                        {/* Pagar só aparece quando a parcela está liberada — com
                            mercadoria pendente, pagar seria fora de ordem. */}
                        {compra.status === "aprovada" &&
                          p.status !== "paga" &&
                          p.liberada_para_pagamento && (
                            <PagarParcelaForm
                              obraId={compra.obra_id}
                              compraId={compra.id}
                              parcelaId={p.id}
                            />
                          )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
