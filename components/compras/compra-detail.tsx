import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { CompraStatusBadge, ParcelaStatusBadge } from "./status-badges";
import { PagarParcelaForm } from "./pagar-parcela-form";
import { CompraAprovacaoActions } from "./compra-aprovacao-actions";
import { formatDateBR as formatDate } from "@/lib/format-date";

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

  const subtotalItens = itens?.reduce((sum, item) => sum + item.total_liquido, 0) ?? 0;

  const fornecedor = compra.fornecedores as unknown as { nome: string } | null;

  let anexoUrl: string | null = null;
  if (compra.anexo_cotacao_path) {
    const { data } = await supabase.storage
      .from("cotacoes")
      .createSignedUrl(compra.anexo_cotacao_path, 60 * 10);
    anexoUrl = data?.signedUrl ?? null;
  }

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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
              <p className="text-muted-foreground">Anexo da cotação</p>
              {anexoUrl ? (
                <a
                  href={anexoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary-texto underline underline-offset-4"
                >
                  Ver arquivo
                </a>
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
            <CompraAprovacaoActions compraId={compra.id} parcelaUnicaId={parcelaUnica?.id} />
          )}
          {viewerRole === "engenheiro" && compra.status === "cotada" && (
            <p className="text-sm text-muted-foreground">Aguardando aprovação do cliente.</p>
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
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Entrega prevista</TableHead>
                  <TableHead>Recebido</TableHead>
                  <TableHead>Status</TableHead>
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
                    <TableCell>{formatDate(p.data_entrega_prevista)}</TableCell>
                    <TableCell
                      className={
                        p.data_entrega_prevista &&
                        p.data_entrega_real &&
                        p.data_entrega_real > p.data_entrega_prevista
                          ? "text-destructive"
                          : ""
                      }
                    >
                      {formatDate(p.data_entrega_real)}
                    </TableCell>
                    <TableCell>
                      <ParcelaStatusBadge status={p.status_efetivo} />
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
                      {compra.status === "aprovada" && p.status !== "paga" && (
                        <PagarParcelaForm compraId={compra.id} parcelaId={p.id} />
                      )}
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
