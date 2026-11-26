import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateBR } from "@/lib/format-date";
import { hojeIso } from "@/lib/locacoes/calculo";
import { CloudRain, Cloud, Sun, CloudOff } from "lucide-react";
import type { DiarioCondicao } from "@/lib/types/database.types";
import { AbrirDiaForm } from "./abrir-dia-form";
import { BotaoExcluir } from "@/components/ui/botao-excluir";
import { removerDiario } from "@/app/actions/diario";
import { Paginacao } from "@/components/ui/paginacao";
import { faixaDaPagina, lerPagina, POR_PAGINA_PADRAO } from "@/lib/paginacao";
import { AjudaDaPagina } from "@/components/ui/ajuda-da-pagina";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarioDiarios, type DiaCalendario } from "@/components/charts/calendario-diarios";
import { praticabilidade } from "@/lib/diario/condicao";
import { faixaDeMeses } from "@/lib/diario/meses-do-calendario";
import { DiarioVisao, type VisaoDoDiario } from "./diario-visao";

const climaIcone: Record<DiarioCondicao, { icone: typeof Sun; titulo: string }> = {
  ensolarado: { icone: Sun, titulo: "Ensolarado" },
  nublado: { icone: Cloud, titulo: "Nublado" },
  chuvoso: { icone: CloudRain, titulo: "Chuvoso" },
  chuva_forte: { icone: CloudOff, titulo: "Chuva forte" },
};

/** Um ícone, um dia. Eram três — ver a nota do campo único em `diario-form`. */
function ClimaDoDia({ clima }: { clima: DiarioCondicao | null }) {
  if (!clima) return <span className="text-muted-foreground">—</span>;
  const { icone: Icone, titulo } = climaIcone[clima];
  return (
    <span className="flex items-center gap-1.5">
      <Icone
        className={clima === "chuva_forte" ? "size-4 text-destructive" : "size-4"}
        aria-hidden
      />
      <span className="text-sm">{titulo}</span>
    </span>
  );
}

export default async function DiarioObraPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ pagina?: string; visao?: string; mes?: string }>;
}) {
  const { obraId } = await params;
  const { pagina: paginaParam, visao: visaoParam, mes } = await searchParams;
  const supabase = await createClient();
  const hoje = hojeIso();

  /*
   * A aba vem da URL, não de estado de cliente — ver o cabeçalho de
   * `diario-visao.tsx`. Qualquer valor diferente cai na listagem, que é o
   * padrão histórico desta tela.
   */
  const visao: VisaoDoDiario = visaoParam === "calendario" ? "calendario" : "lista";

  const { count } = await supabase
    .from("diario_obra")
    .select("data", { count: "exact", head: true })
    .eq("obra_id", obraId);

  const total = count ?? 0;
  const { pagina, de, ate } = faixaDaPagina(lerPagina(paginaParam), total);

  /*
   * Cada aba paga só pelo que mostra.
   *
   * A listagem quer uma fatia paginada com texto; o calendário quer a data e o
   * clima do mês inteiro, mais as folgas. Buscar os dois sempre dobraria a
   * consulta de uma tela para entregar metade dela fechada num `hidden`.
   * `Promise.resolve(null)` é o mesmo recurso usado em `carregar-rdo.ts`.
   */
  const [{ data: dias }, { count: diasDeHoje }, todasAsDatas, folgas] = await Promise.all([
    visao === "lista"
      ? supabase
          .from("diario_obra")
          .select("data, clima, atividades, ocorrencias, fechado_em")
          .eq("obra_id", obraId)
          .order("data", { ascending: false })
          .range(de, ate)
      : Promise.resolve({ data: null }),
    /*
     * "Já existe folha de hoje?" é pergunta sobre a obra, não sobre a página.
     *
     * Saía de uma varredura na lista inteira, o que com paginação passaria a
     * responder só pelo pedaço visível: da segunda página em diante o botão de
     * abrir o dia reapareceria para um dia que já está aberto.
     */
    supabase
      .from("diario_obra")
      .select("data", { count: "exact", head: true })
      .eq("obra_id", obraId)
      .eq("data", hoje),
    /*
     * TODAS as datas, não só as do mês: elas é que dizem até onde dá para
     * navegar para trás. São uma coluna de poucas centenas de linhas.
     *
     * E sem filtro de `fechado_em`, ao contrário do portal: o cliente só vê
     * folha fechada, o engenheiro precisa ver a que está aberta — senão a folha
     * que ele acabou de salvar não apareceria no próprio calendário dele.
     */
    visao === "calendario"
      ? supabase.from("diario_obra").select("data, clima").eq("obra_id", obraId)
      : Promise.resolve({ data: null }),
    visao === "calendario"
      ? supabase
          .from("cronograma_folgas")
          .select("data_inicio, data_fim")
          .eq("obra_id", obraId)
      : Promise.resolve({ data: null }),
  ]);

  const temHoje = (diasDeHoje ?? 0) > 0;

  const datas = todasAsDatas.data ?? [];
  const { mesAtual, anterior, proximo } = faixaDeMeses({
    datas: datas.map((d) => d.data),
    hoje,
    mes,
  });
  const base = `/obras/${obraId}/diario`;
  const doMes: DiaCalendario[] = datas
    .filter((d) => d.data.startsWith(mesAtual))
    .map((d) => ({ data: d.data, clima: praticabilidade(d.clima) }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-1 font-heading text-lg font-semibold">
            Diário de obra
            <AjudaDaPagina titulo="Diário de obra">
              <p>
                Uma folha por dia. Os equipamentos em obra, as tarefas previstas no cronograma e as
                entregas de material já vêm preenchidos das outras telas — você escreve o efetivo
                por função, o clima, as atividades, as ocorrências e as visitas.
              </p>
              <p>
                Ao <strong>fechar o dia</strong>, esse conteúdo congela, a folha vira documento e o
                cliente passa a vê-la no portal dele.
              </p>
            </AjudaDaPagina>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {!temHoje && (
            <Button
              nativeButton={false}
              render={<Link href={`/obras/${obraId}/diario/${hoje}`}>Diário de hoje</Link>}
            />
          )}
          <AbrirDiaForm obraId={obraId} />
        </div>
      </div>

      <DiarioVisao base={base} visao={visao} />

      {visao === "calendario" && (
        <Card>
          <CardContent className="flex flex-col gap-4 py-4">
            <div className="flex items-center justify-between gap-2">
              <Button
                nativeButton={!anterior}
                variant="outline"
                size="sm"
                disabled={!anterior}
                aria-label="Mês anterior"
                render={
                  anterior ? (
                    /* `visao=calendario` viaja junto: sem ele o link cairia na
                       listagem, que é o padrão de quem não manda a aba. */
                    <Link href={`${base}?visao=calendario&mes=${anterior}`} scroll={false}>
                      <ChevronLeft className="size-4" />
                    </Link>
                  ) : undefined
                }
              >
                {anterior ? undefined : <ChevronLeft className="size-4" />}
              </Button>

              <p className="text-sm text-muted-foreground">
                {doMes.length
                  ? `${doMes.length} ${doMes.length === 1 ? "dia registrado" : "dias registrados"} neste mês`
                  : "Nenhum dia registrado neste mês"}
              </p>

              <Button
                nativeButton={!proximo}
                variant="outline"
                size="sm"
                disabled={!proximo}
                aria-label="Próximo mês"
                render={
                  proximo ? (
                    <Link href={`${base}?visao=calendario&mes=${proximo}`} scroll={false}>
                      <ChevronRight className="size-4" />
                    </Link>
                  ) : undefined
                }
              >
                {proximo ? undefined : <ChevronRight className="size-4" />}
              </Button>
            </div>

            {/*
              `diasSemRegistroClicaveis` aqui tem outro sentido que no portal.
              Lá o dia sem RDO abre uma tela dizendo que não houve registro;
              aqui ele abre a folha para PREENCHER, que é a razão de o
              engenheiro procurar um buraco no calendário.
            */}
            <CalendarioDiarios
              dias={doMes}
              mesReferencia={mesAtual}
              base={`/obras/${obraId}`}
              hoje={hoje}
              folgas={(folgas.data ?? []).map((f) => ({
                dataInicio: f.data_inicio,
                dataFim: f.data_fim,
              }))}
              diasSemRegistroClicaveis
            />
          </CardContent>
        </Card>
      )}

      {visao === "lista" && (
        <>
        <div className="flex flex-col gap-2">
          {/*
            A lixeira fica NA LINHA, não dentro do dia.
          
            Estava na tela de detalhe, e por isso apagar um dia aberto por engano
            — data errada no calendário, um toque a mais no celular — exigia
            abrir o dia primeiro. A lista é onde se vê que ele sobra; é nela que
            tem de haver como tirá-lo.
          
            O link deixou de envolver a linha inteira e passou a envolver só o
            bloco de texto: um botão dentro de um link é marcação inválida, e o
            clique na lixeira navegava antes de confirmar.
          */}
          {dias?.map((dia) => (
            <div
              key={dia.data}
              className="flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/50"
            >
              <Link
                href={`/obras/${obraId}/diario/${dia.data}`}
                className="flex min-w-0 flex-1 items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {formatDateBR(dia.data)}
                    {dia.data === hoje && <Badge variant="outline">Hoje</Badge>}
                    {dia.fechado_em ? (
                      <Badge variant="secondary">Fechado</Badge>
                    ) : (
                      <Badge variant="outline">Aberto</Badge>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {dia.atividades || dia.ocorrencias || "Sem anotações ainda."}
                  </p>
                </div>
                <ClimaDoDia clima={dia.clima} />
              </Link>
              <BotaoExcluir
                rotulo="Excluir RDO"
                confirmacao={
                  `Excluir o RDO de ${formatDateBR(dia.data)}? O registro do dia, as fotos anexadas e o efetivo lançado na folha vão embora, e não dá para desfazer.` +
                  (dia.fechado_em
                    ? "\n\nAtenção: essa folha está FECHADA — é documento, e o cliente já a enxerga no portal dele."
                    : "")
                }
                acao={removerDiario.bind(null, obraId, dia.data)}
              />
            </div>
          ))}
          {!dias?.length && (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhum dia registrado ainda. Comece pelo diário de hoje.
            </p>
          )}
        </div>

        <Paginacao
          pagina={pagina}
          total={total}
          porPagina={POR_PAGINA_PADRAO}
          caminho={base}
          rotulo="dias"
        />
        </>
      )}
    </div>
  );
}
