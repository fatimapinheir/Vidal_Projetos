import { createClient } from "@/lib/supabase/server";
import { formatDateBR } from "@/lib/format-date";
import { FolgasCalendario } from "./folgas-calendario";
import { NovaFolgaDialog } from "./nova-folga-dialog";
import { RemoverFolgaButton } from "./folgas-actions";
import { Paginacao } from "@/components/ui/paginacao";
import { faixaDaPagina, lerPagina, POR_PAGINA_PADRAO } from "@/lib/paginacao";
import { AjudaDaPagina } from "@/components/ui/ajuda-da-pagina";

export default async function FolgasObraPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ pagina?: string }>;
}) {
  const { obraId } = await params;
  const { pagina: paginaParam } = await searchParams;
  const supabase = await createClient();

  const { count } = await supabase
    .from("cronograma_folgas")
    .select("id", { count: "exact", head: true })
    .eq("obra_id", obraId);

  const total = count ?? 0;
  const { pagina, de, ate } = faixaDaPagina(lerPagina(paginaParam), total);

  const [{ data: folgas }, { data: todasAsDatas }] = await Promise.all([
    supabase
      .from("cronograma_folgas")
      .select("*")
      .eq("obra_id", obraId)
      .order("data_inicio", { ascending: false })
      .range(de, ate),
    /*
     * O calendário precisa de TODAS as folgas, não da página — uma folga fora
     * da página atual deixaria de ser pintada e o mês mentiria. Por isso esta
     * consulta fica sem paginar, e em troca pede só as duas datas: é a lista
     * mais leve possível da mesma informação.
     */
    supabase
      .from("cronograma_folgas")
      .select("data_inicio, data_fim")
      .eq("obra_id", obraId),
  ]);

  const folgasResumo = (todasAsDatas ?? []).map((f) => ({
    dataInicio: f.data_inicio,
    dataFim: f.data_fim,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-1 font-heading text-lg font-semibold">
            Folgas
            <AjudaDaPagina titulo="Folgas">
              <p>
                Dias que não contam como dia útil no cálculo do cronograma — cadastre qualquer data
                (chuva, feriado local, recesso, o que for), independente de fim de semana.
              </p>
              <p>
                Elas afetam automaticamente as datas de início e fim das tarefas em Cronograma.
              </p>
            </AjudaDaPagina>
          </h1>
        </div>
        <NovaFolgaDialog obraId={obraId} />
      </div>

      <div className="rounded-xl border p-4">
        <FolgasCalendario obraId={obraId} folgas={folgasResumo} />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-heading text-base font-semibold">Folgas registradas</h2>
        {folgas?.map((folga) => (
          <div key={folga.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
            <span>
              {folga.data_inicio === folga.data_fim
                ? formatDateBR(folga.data_inicio)
                : `${formatDateBR(folga.data_inicio)} – ${formatDateBR(folga.data_fim)}`}
              {folga.descricao ? ` — ${folga.descricao}` : ""}
            </span>
            <RemoverFolgaButton obraId={obraId} folgaId={folga.id} />
          </div>
        ))}
        {!folgas?.length && (
          <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
            Nenhuma folga registrada.
          </p>
        )}

        <Paginacao
          pagina={pagina}
          total={total}
          porPagina={POR_PAGINA_PADRAO}
          caminho={`/obras/${obraId}/folgas`}
          rotulo="folgas"
        />
      </div>
    </div>
  );
}
