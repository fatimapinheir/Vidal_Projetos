import { createClient } from "@/lib/supabase/server";
import { SpreadsheetUploadWizard, type MapeamentoSalvo } from "@/components/upload/spreadsheet-upload-wizard";
import { ativarNovaTabelaSinapi } from "@/app/actions/sinapi";

export default async function UploadSinapiPage() {
  const supabase = await createClient();
  const { data: mapeamento } = await supabase
    .from("sinapi_mapeamento")
    .select("linha_cabecalho, mapa_colunas")
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
        <h1 className="font-heading text-lg font-semibold">Atualizar tabela SINAPI</h1>
        <p className="text-sm text-muted-foreground">
          Envie a planilha de referência do mês. Ela substitui a tabela ativa do sistema — não
          afeta os orçamentos já montados nas obras, cujos preços já foram copiados.
        </p>
      </div>
      <SpreadsheetUploadWizard
        mapeamentoSalvo={mapeamentoSalvo}
        mostrarMesReferencia
        campos={["codigo_sinapi", "descricao", "unidade", "preco_unitario"]}
        labelBase="Ativar tabela SINAPI"
        bucket="sinapi"
        onConfirm={ativarNovaTabelaSinapi}
      />
    </div>
  );
}
