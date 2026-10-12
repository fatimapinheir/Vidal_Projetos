import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LancamentoForm } from "@/components/compras/lancamento-form";
import { etapasDoOrcamentoAtivo } from "@/lib/compras/etapa-orcamento";

/** `date` do Postgres chega como ISO completo; o input quer só o dia. */
const soData = (valor: string | null) => valor?.slice(0, 10) ?? "";

/**
 * Edição de um lançamento financeiro já registrado.
 *
 * Só lançamento. A ordem de compra tem plano de parcelas — possivelmente com
 * parcela já paga, comprovante anexado e aprovação do cliente registrada — e
 * mexer no valor dela significa refazer esse plano. Isso é outra tela, e
 * fingir que o mesmo formulário dá conta produziria um estado inconsistente
 * no primeiro uso.
 */
export default async function EditarLancamentoPage({
  params,
}: {
  params: Promise<{ obraId: string; compraId: string }>;
}) {
  const { obraId, compraId } = await params;
  await requireRole("engenheiro");
  const supabase = await createClient();

  const [{ data: compra }, { data: fornecedores }, { data: categorias }, etapasOrcamento] =
    await Promise.all([
      supabase.from("compras").select("*").eq("id", compraId).eq("obra_id", obraId).maybeSingle(),
      supabase.from("fornecedores").select("id, nome").eq("ativo", true).order("nome"),
      supabase
        .from("categorias_financeiras")
        .select("id, nome, tipo_item")
        .eq("ativo", true)
        .order("nome"),
      etapasDoOrcamentoAtivo(supabase, obraId),
    ]);

  if (!compra) notFound();
  // Ordem de compra cai de volta no detalhe em vez de abrir um formulário que
  // não sabe editá-la.
  if (!compra.eh_lancamento) redirect(`/obras/${obraId}/compras/${compraId}`);

  const { data: itens } = await supabase
    .from("compra_itens")
    .select("*")
    .eq("compra_id", compraId)
    .order("ordem");

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="-ml-2"
          render={
            <Link href={`/obras/${obraId}/compras/${compraId}`}>
              <ChevronLeft className="size-4" />
              Voltar ao lançamento
            </Link>
          }
        />
      </div>

      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>Editar lançamento</CardTitle>
          <CardDescription>
            Os arquivos anexados são geridos na tela do lançamento, onde também dá para removê-los.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LancamentoForm
            obraId={obraId}
            fornecedores={fornecedores ?? []}
            categorias={categorias ?? []}
            etapasOrcamento={etapasOrcamento}
            voltarPara={`/obras/${obraId}/compras/${compraId}`}
            inicial={{
              id: compra.id,
              fornecedorId: compra.fornecedor_id,
              categoriaId: compra.categoria_id ?? "",
              descricao: compra.descricao,
              tipoItem: compra.tipo_item ?? "",
              orcamentoEtapa: compra.orcamento_etapa ?? "",
              formaPagamento: compra.forma_pagamento,
              valor: compra.valor_total,
              dataPagamento: soData(compra.data_cotacao),
              notaNumero: compra.nota_fiscal_numero ?? "",
              notaEmissao: soData(compra.nota_fiscal_emissao),
              entregaPrevista: soData(compra.data_entrega_prevista),
              entregaReal: soData(compra.data_entrega_real),
              itens: (itens ?? []).map((item) => ({
                orcamento_item_id: item.orcamento_item_id ?? undefined,
                descricao: item.descricao,
                unidade: item.unidade,
                quantidade: item.quantidade,
                preco_unitario: item.preco_unitario,
                desconto_tipo: item.desconto_tipo ?? undefined,
                desconto_valor: item.desconto_valor ?? undefined,
              })),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
