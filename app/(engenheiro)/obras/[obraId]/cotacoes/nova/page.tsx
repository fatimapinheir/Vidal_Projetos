import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CotacaoForm } from "@/components/cotacoes/cotacao-form";
import { etapasDoOrcamentoAtivo } from "@/lib/compras/etapa-orcamento";

export default async function NovaCotacaoPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const supabase = await createClient();
  const etapasOrcamento = await etapasDoOrcamentoAtivo(supabase, obraId);

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Nova cotação</CardTitle>
      </CardHeader>
      <CardContent>
        <CotacaoForm obraId={obraId} etapasOrcamento={etapasOrcamento} />
      </CardContent>
    </Card>
  );
}
