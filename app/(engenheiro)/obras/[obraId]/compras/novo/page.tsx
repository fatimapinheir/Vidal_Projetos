import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { OrdemCompraForm } from "@/components/compras/ordem-compra-form";

export default async function NovaCompraPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const supabase = await createClient();
  // Só ativos: inativo não deve ser escolhível numa compra nova. As compras
  // já registradas seguem mostrando o fornecedor pelo vínculo, mesmo inativo.
  const [{ data: fornecedores }, { data: versaoAtiva }, { data: categorias }] = await Promise.all([
    supabase.from("fornecedores").select("id, nome").eq("ativo", true).order("nome"),
    supabase
      .from("orcamento_versoes")
      .select("id, etapas")
      .eq("obra_id", obraId)
      .eq("status", "ativa")
      .maybeSingle(),
    supabase
      .from("categorias_financeiras")
      .select("id, nome, tipo_item")
      .eq("ativo", true)
      .order("nome"),
  ]);

  // As etapas declaradas na versão, mais as que só existem em item (vindas de
  // importação de planilha) — as duas aparecem na tela do orçamento, então as
  // duas têm de ser escolhíveis aqui.
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

  return (
    <Card className="max-w-5xl">
      <CardHeader>
        <CardTitle>Nova ordem de compra</CardTitle>
      </CardHeader>
      <CardContent>
        <OrdemCompraForm
          obraId={obraId}
          fornecedores={fornecedores ?? []}
          categorias={categorias ?? []}
          etapasOrcamento={etapasOrcamento}
        />
      </CardContent>
    </Card>
  );
}
