import { Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/get-profile";
import {
  SpreadsheetUploadWizard,
  type MapeamentoSalvo,
} from "@/components/upload/spreadsheet-upload-wizard";
import { importarPlanilhaParaRascunho } from "@/app/actions/orcamento";
import { ETAPAS_ORCAMENTO } from "@/lib/orcamento/templates";

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
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="font-heading text-lg font-semibold">Importar planilha de orçamento</h1>
          <p className="text-sm text-muted-foreground">
            Os itens serão adicionados ao rascunho do orçamento dessa obra. Você revisa e ativa
            depois, na tela de Orçamento.
          </p>
        </div>

        {/*
          O modelo fica aqui, antes do assistente, porque é onde a dúvida
          aparece: a planilha já existe e o engenheiro não sabe se ela serve.
          O arquivo é gerado por scripts/gerar-modelo-orcamento.mjs.
        */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 shadow-xs">
          <FileSpreadsheet className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Não sabe como montar a planilha?</p>
            <p className="text-xs text-muted-foreground">
              O modelo traz as seis colunas que o sistema lê, exemplos preenchidos, a lista de
              etapas para copiar e uma aba explicando as regras.
            </p>
          </div>
          <Button
            nativeButton={false}
            variant="outline"
            size="sm"
            render={
              <a href="/modelo-orcamento.xlsx" download>
                <Download className="size-4" />
                Baixar modelo
              </a>
            }
          />
        </div>

        <p className="text-sm text-muted-foreground">
          Sua planilha não precisa ser igual ao modelo: o sistema procura o cabeçalho e reconhece
          os nomes de coluna mais usados, em qualquer aba. Se não acertar, você ajusta à mão nos
          passos abaixo.
        </p>
      </div>
      <SpreadsheetUploadWizard
        mapeamentoSalvo={mapeamentoSalvo}
        labelBase="Importar itens para o rascunho"
        bucket="orcamentos"
        prefixoPath={obraId}
        etapasOficiais={ETAPAS_ORCAMENTO}
        onConfirm={importarPlanilhaParaRascunho.bind(null, obraId, rascunho!.id)}
      />
    </div>
  );
}
