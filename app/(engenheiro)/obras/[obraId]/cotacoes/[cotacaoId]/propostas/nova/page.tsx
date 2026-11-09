import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { PropostaForm } from "@/components/cotacoes/proposta-form";
import { buscarInsumosAtivos } from "@/lib/compras/insumos-ativos";

export default async function NovaPropostaPage({
  params,
}: {
  params: Promise<{ obraId: string; cotacaoId: string }>;
}) {
  const { obraId, cotacaoId } = await params;
  const supabase = await createClient();

  const [{ data: cotacao }, { data: fornecedores }, { data: categorias }, insumos] =
    await Promise.all([
      supabase
        .from("cotacoes")
        .select("id, obra_id, descricao, status")
        .eq("id", cotacaoId)
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
  if (cotacao.status === "decidida" || cotacao.status === "recusada") notFound();

  return (
    <Card className="max-w-5xl">
      <CardHeader>
        <CardTitle>Nova proposta</CardTitle>
        {/* Repete o que está sendo cotado: quem chega aqui vindo da lista de
            propostas precisa lembrar para quê está digitando preço. */}
        <CardDescription>{cotacao.descricao}</CardDescription>
      </CardHeader>
      <CardContent>
        <PropostaForm
          obraId={obraId}
          cotacaoId={cotacaoId}
          fornecedores={fornecedores ?? []}
          categorias={categorias ?? []}
          insumos={insumos}
        />
      </CardContent>
    </Card>
  );
}
