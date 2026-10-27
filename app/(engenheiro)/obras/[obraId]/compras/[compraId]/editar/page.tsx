import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LancamentoForm } from "@/components/compras/lancamento-form";
import { OrdemCompraForm } from "@/components/compras/ordem-compra-form";
import { etapasDoOrcamentoAtivo } from "@/lib/compras/etapa-orcamento";
import { buscarInsumosAtivos } from "@/lib/compras/insumos-ativos";

/** `date` do Postgres chega como ISO completo; o input quer só o dia. */
const soData = (valor: string | null) => valor?.slice(0, 10) ?? "";

/**
 * Edição de uma compra já registrada — lançamento financeiro ou ordem de compra.
 *
 * Os dois formulários são diferentes porque as duas coisas são diferentes: o
 * lançamento é um pagamento que já aconteceu, a ordem é um plano de compra com
 * itens, parcelas e condições. O que esta tela faz é escolher qual deles abrir.
 *
 * Por um tempo a ordem de compra simplesmente não era editável — caía de volta
 * no detalhe —, e corrigir um fornecedor trocado exigia recriar a ordem e
 * perder anexos e histórico de aprovação. O que de fato não pode ser reescrito
 * é o dinheiro já movimentado, e isso é tratado dentro do formulário: ver
 * `valorCongelado`.
 */
export default async function EditarCompraPage({
  params,
}: {
  params: Promise<{ obraId: string; compraId: string }>;
}) {
  const { obraId, compraId } = await params;
  await requireRole("engenheiro");
  const supabase = await createClient();

  const [{ data: compra }, { data: fornecedores }, { data: categorias }, etapasOrcamento, insumos] =
    await Promise.all([
      supabase.from("compras").select("*").eq("id", compraId).eq("obra_id", obraId).maybeSingle(),
      supabase.from("fornecedores").select("id, nome").eq("ativo", true).order("nome"),
      supabase
        .from("categorias_financeiras")
        .select("id, nome, tipo_item")
        .eq("ativo", true)
        .order("nome"),
      etapasDoOrcamentoAtivo(supabase, obraId),
      buscarInsumosAtivos(supabase),
    ]);

  if (!compra) notFound();

  const { data: itens } = await supabase
    .from("compra_itens")
    .select("*")
    .eq("compra_id", compraId)
    .order("ordem");

  const voltarPara = `/obras/${obraId}/compras/${compraId}`;
  const ehLancamento = compra.eh_lancamento;

  const { data: parcelas } = ehLancamento
    ? { data: null }
    : await supabase
        .from("compra_parcelas")
        .select("valor, data_vencimento, status, data_pagamento, comprovante_pagamento_path, pagamento_enviado_em")
        .eq("compra_id", compraId)
        .order("numero_parcela");

  // O mesmo critério da ação `atualizarCompra`: o que trava o valor é
  // pagamento já movimentado, não a aprovação do cliente.
  const valorCongelado = (parcelas ?? []).some(
    (p) =>
      p.status === "paga" ||
      !!p.data_pagamento ||
      !!p.comprovante_pagamento_path ||
      !!p.pagamento_enviado_em
  );

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="-ml-2"
          render={
            <Link href={voltarPara}>
              <ChevronLeft className="size-4" />
              {ehLancamento ? "Voltar ao lançamento" : "Voltar à ordem de compra"}
            </Link>
          }
        />
      </div>

      <Card className={ehLancamento ? "max-w-4xl" : "max-w-5xl"}>
        <CardHeader>
          <CardTitle>{ehLancamento ? "Editar lançamento" : "Editar ordem de compra"}</CardTitle>
          <CardDescription>
            Os arquivos anexados são geridos na tela{" "}
            {ehLancamento ? "do lançamento" : "da ordem"}, onde também dá para removê-los.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ehLancamento ? (
            <LancamentoForm
              obraId={obraId}
              fornecedores={fornecedores ?? []}
              categorias={categorias ?? []}
              insumos={insumos}
              etapasOrcamento={etapasOrcamento}
              voltarPara={voltarPara}
              inicial={{
                id: compra.id,
                fornecedorId: compra.fornecedor_id,
                categoriaId: compra.categoria_id ?? "",
                descricao: compra.descricao,
                tipoItem: compra.tipo_item ?? "",
                orcamentoEtapa: compra.orcamento_etapa ?? "",
                formaPagamento: compra.forma_pagamento,
                dataPagamento: soData(compra.data_cotacao),
                notaNumero: compra.nota_fiscal_numero ?? "",
                notaEmissao: soData(compra.nota_fiscal_emissao),
                entregaPrevista: soData(compra.data_entrega_prevista),
                entregaReal: soData(compra.data_entrega_real),
                itens: (itens ?? []).map((item) => ({
                  orcamento_item_id: item.orcamento_item_id ?? undefined,
                  insumo_id: item.insumo_id ?? undefined,
                  descricao: item.descricao,
                  unidade: item.unidade,
                  categoria_custo: item.categoria_custo ?? undefined,
                  quantidade: item.quantidade,
                  preco_unitario: item.preco_unitario,
                  desconto_tipo: item.desconto_tipo ?? undefined,
                  desconto_valor: item.desconto_valor ?? undefined,
                })),
              }}
            />
          ) : (
            <OrdemCompraForm
              obraId={obraId}
              fornecedores={fornecedores ?? []}
              categorias={categorias ?? []}
              insumos={insumos}
              etapasOrcamento={etapasOrcamento}
              valorCongelado={valorCongelado}
              inicial={{
                id: compra.id,
                fornecedorId: compra.fornecedor_id,
                categoriaId: compra.categoria_id ?? "",
                descricao: compra.descricao,
                tipoItem: compra.tipo_item ?? "",
                orcamentoEtapa: compra.orcamento_etapa ?? "",
                formaPagamento: compra.forma_pagamento,
                dataCotacao: soData(compra.data_cotacao),
                entregaPrevista: soData(compra.data_entrega_prevista),
                notaNumero: compra.nota_fiscal_numero ?? "",
                notaEmissao: soData(compra.nota_fiscal_emissao),
                requerAprovacaoCliente: compra.requer_aprovacao_cliente,
                pagamentoAposRecebimento: compra.pagamento_apos_recebimento,
                descontoTipo: compra.desconto_tipo ?? "",
                descontoValor: compra.desconto_valor ? String(compra.desconto_valor) : "",
                itens: (itens ?? []).map((item) => ({
                  orcamento_item_id: item.orcamento_item_id ?? undefined,
                  insumo_id: item.insumo_id ?? undefined,
                  descricao: item.descricao,
                  unidade: item.unidade,
                  categoria_custo: item.categoria_custo ?? undefined,
                  quantidade: item.quantidade,
                  preco_unitario: item.preco_unitario,
                  desconto_tipo: item.desconto_tipo ?? undefined,
                  desconto_valor: item.desconto_valor ?? undefined,
                })),
                parcelas: (parcelas ?? []).map((p) => ({
                  valor: p.valor.toFixed(2),
                  vencimento: soData(p.data_vencimento),
                })),
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
