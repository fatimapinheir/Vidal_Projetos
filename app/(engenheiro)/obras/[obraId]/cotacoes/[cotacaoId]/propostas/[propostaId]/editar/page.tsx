import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { PropostaForm } from "@/components/cotacoes/proposta-form";
import { buscarInsumosAtivos } from "@/lib/compras/insumos-ativos";

export default async function EditarPropostaPage({
  params,
}: {
  params: Promise<{ obraId: string; cotacaoId: string; propostaId: string }>;
}) {
  const { obraId, cotacaoId, propostaId } = await params;
  const supabase = await createClient();

  const [{ data: cotacao }, { data: proposta }, { data: fornecedores }, { data: categorias }, insumos] =
    await Promise.all([
      supabase
        .from("cotacoes")
        .select("id, obra_id, descricao, status")
        .eq("id", cotacaoId)
        .maybeSingle(),
      supabase
        .from("cotacao_propostas")
        .select(
          "id, cotacao_id, fornecedor_id, categoria_id, observacoes, forma_pagamento, data_proposta, data_entrega_prevista, desconto_tipo, desconto_valor"
        )
        .eq("id", propostaId)
        .maybeSingle(),
      supabase.from("fornecedores").select("id, nome").eq("ativo", true).order("nome"),
      supabase
        .from("categorias_financeiras")
        .select("id, nome, tipo_item")
        .eq("ativo", true)
        .order("nome"),
      buscarInsumosAtivos(supabase),
    ]);

  if (!cotacao || cotacao.obra_id !== obraId) notFound();
  if (!proposta || proposta.cotacao_id !== cotacaoId) notFound();
  if (cotacao.status === "decidida" || cotacao.status === "recusada") notFound();

  const [{ data: itens }, { data: parcelas }] = await Promise.all([
    supabase
      .from("cotacao_proposta_itens")
      .select(
        "insumo_id, orcamento_item_id, descricao, unidade, categoria_custo, quantidade, preco_unitario, desconto_tipo, desconto_valor, ordem"
      )
      .eq("proposta_id", propostaId)
      .order("ordem", { ascending: true }),
    supabase
      .from("cotacao_proposta_parcelas")
      .select("valor, data_vencimento, numero_parcela")
      .eq("proposta_id", propostaId)
      .order("numero_parcela", { ascending: true }),
  ]);

  return (
    <Card className="max-w-5xl">
      <CardHeader>
        <CardTitle>Editar proposta</CardTitle>
        <CardDescription>{cotacao.descricao}</CardDescription>
      </CardHeader>
      <CardContent>
        <PropostaForm
          obraId={obraId}
          cotacaoId={cotacaoId}
          fornecedores={fornecedores ?? []}
          categorias={categorias ?? []}
          insumos={insumos}
          inicial={{
            id: proposta.id,
            fornecedorId: proposta.fornecedor_id,
            categoriaId: proposta.categoria_id ?? "",
            observacoes: proposta.observacoes ?? "",
            formaPagamento: proposta.forma_pagamento,
            dataProposta: proposta.data_proposta,
            entregaPrevista: proposta.data_entrega_prevista ?? "",
            descontoTipo: proposta.desconto_tipo ?? "",
            descontoValor:
              proposta.desconto_valor === null ? "" : String(Number(proposta.desconto_valor)),
            itens: (itens ?? []).map((i) => ({
              insumo_id: i.insumo_id ?? undefined,
              orcamento_item_id: i.orcamento_item_id ?? undefined,
              descricao: i.descricao,
              unidade: i.unidade,
              categoria_custo: i.categoria_custo ?? undefined,
              quantidade: Number(i.quantidade),
              preco_unitario: Number(i.preco_unitario),
              desconto_tipo: i.desconto_tipo ?? undefined,
              desconto_valor:
                i.desconto_valor === null ? undefined : Number(i.desconto_valor),
            })),
            parcelas: (parcelas ?? []).map((p) => ({
              valor: Number(p.valor).toFixed(2),
              vencimento: p.data_vencimento,
            })),
          }}
        />
      </CardContent>
    </Card>
  );
}
