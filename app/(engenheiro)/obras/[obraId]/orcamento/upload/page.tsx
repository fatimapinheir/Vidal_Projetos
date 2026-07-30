import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/get-profile";
import {
  SpreadsheetUploadWizard,
  type MapeamentoSalvo,
} from "@/components/upload/spreadsheet-upload-wizard";
import { importarPlanilhaParaRascunho } from "@/app/actions/orcamento";

export default async function UploadOrcamentoPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const supabase = await createClient();

  let { data: rascunho } = await supabase
    .from("orcamento_versoes")
    .select("id")
    .eq("obra_id", obraId)
    .eq("status", "rascunho")
    .maybeSingle();

  if (!rascunho) {
    const profile = await getProfile();
    const { data: novoRascunho } = await supabase
      .from("orcamento_versoes")
      .insert({ obra_id: obraId, criado_por: profile!.id })
      .select("id")
      .single();
    rascunho = novoRascunho;
  }

  const { data: mapeamento } = await supabase
    .from("orcamento_mapeamentos")
    .select("linha_cabecalho, mapa_colunas")
    .eq("obra_id", obraId)
    .maybeSingle();

  const mapeamentoSalvo: MapeamentoSalvo = mapeamento
    ? {
        linha_cabecalho: mapeamento.linha_cabecalho,
        mapa_colunas: mapeamento.mapa_colunas as Record<string, number>,
      }
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-lg font-semibold">Importar planilha de planejamento</h1>
        <p className="text-sm text-muted-foreground">
          Os itens serão adicionados ao rascunho do planejamento dessa obra. Você revisa e ativa
          depois, na tela de Planejamento.
        </p>
      </div>
      <SpreadsheetUploadWizard
        mapeamentoSalvo={mapeamentoSalvo}
        labelBase="Importar itens para o rascunho"
        bucket="orcamentos"
        prefixoPath={obraId}
        onConfirm={importarPlanilhaParaRascunho.bind(null, obraId, rascunho!.id)}
      />
    </div>
  );
}
