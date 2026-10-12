import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { LancamentoForm } from "@/components/compras/lancamento-form";
import { etapasDoOrcamentoAtivo } from "@/lib/compras/etapa-orcamento";

export default async function NovoLancamentoPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  await requireRole("engenheiro");
  const supabase = await createClient();

  const [{ data: fornecedores }, { data: categorias }, etapasOrcamento] = await Promise.all([
    supabase.from("fornecedores").select("id, nome").eq("ativo", true).order("nome"),
    supabase
      .from("categorias_financeiras")
      .select("id, nome, tipo_item")
      .eq("ativo", true)
      .order("nome"),
    etapasDoOrcamentoAtivo(supabase, obraId),
  ]);

  return (
    <Card className="max-w-4xl">
      <CardHeader>
        <CardTitle>Novo lançamento financeiro</CardTitle>
        <CardDescription>
          Para pagamentos que já aconteceram — IPTU, água, uma compra avulsa. Sem cotação,
          aprovação, entrega nem parcelamento.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LancamentoForm
          obraId={obraId}
          fornecedores={fornecedores ?? []}
          categorias={categorias ?? []}
          voltarPara={`/obras/${obraId}/compras`}
          etapasOrcamento={etapasOrcamento}
        />
      </CardContent>
    </Card>
  );
}
