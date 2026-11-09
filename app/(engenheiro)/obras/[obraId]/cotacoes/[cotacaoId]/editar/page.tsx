import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CotacaoForm } from "@/components/cotacoes/cotacao-form";
import { etapasDoOrcamentoAtivo } from "@/lib/compras/etapa-orcamento";

export default async function EditarCotacaoPage({
  params,
}: {
  params: Promise<{ obraId: string; cotacaoId: string }>;
}) {
  const { obraId, cotacaoId } = await params;
  const supabase = await createClient();

  const [{ data: cotacao }, etapasOrcamento] = await Promise.all([
    supabase
      .from("cotacoes")
      .select("id, obra_id, descricao, orcamento_etapa, prazo_decisao, observacoes, status")
      .eq("id", cotacaoId)
      .maybeSingle(),
    etapasDoOrcamentoAtivo(supabase, obraId),
  ]);

  if (!cotacao || cotacao.obra_id !== obraId) notFound();
  // Decidida, não se edita: a descrição já virou a descrição de uma ordem de
  // compra, e mudá-la aqui faria as duas telas contarem histórias diferentes.
  if (cotacao.status === "decidida" || cotacao.status === "recusada") notFound();

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Editar cotação</CardTitle>
      </CardHeader>
      <CardContent>
        <CotacaoForm
          obraId={obraId}
          etapasOrcamento={etapasOrcamento}
          inicial={{
            id: cotacao.id,
            descricao: cotacao.descricao,
            orcamentoEtapa: cotacao.orcamento_etapa ?? "",
            prazoDecisao: cotacao.prazo_decisao ?? "",
            observacoes: cotacao.observacoes ?? "",
          }}
        />
      </CardContent>
    </Card>
  );
}
