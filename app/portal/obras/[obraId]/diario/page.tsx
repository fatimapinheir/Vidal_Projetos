import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, NotebookPen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarioDiarios, type DiaCalendario } from "@/components/charts/calendario-diarios";
import { praticabilidade } from "@/lib/diario/condicao";
import { hojeNoFuso } from "@/lib/fuso";
import { formatDateBR } from "@/lib/format-date";

const MES_ISO = /^\d{4}-\d{2}$/;

/** Mês vizinho, sem passar por `Date` com fuso — tudo em aritmética de ISO. */
function mesVizinho(mes: string, passo: number): string {
  const [ano, m] = mes.split("-").map(Number);
  const total = ano * 12 + (m - 1) + passo;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/**
 * O diário de obra do cliente, em calendário.
 *
 * Era uma lista de dias publicados. A lista responde "o que foi publicado";
 * o calendário responde "o que aconteceu no mês" — e essa é a pergunta, porque
 * inclui os dias em que NÃO houve registro. Numa lista, um dia sem RDO
 * simplesmente não existe, e quem olha não sabe se a obra parou, se o
 * engenheiro não lançou ou se ele próprio está vendo errado.
 *
 * Por isso os dias sem registro são clicáveis aqui: abrem uma tela que diz,
 * com todas as letras, que aquele dia não tem RDO.
 */
export default async function PortalDiarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ mes?: string }>;
}) {
  const { obraId } = await params;
  const { mes } = await searchParams;
  const supabase = await createClient();

  const { data: obra } = await supabase.from("obras").select("nome").eq("id", obraId).single();
  if (!obra) notFound();

  const hoje = hojeNoFuso();
  const mesAtual = MES_ISO.test(mes ?? "") ? mes! : hoje.slice(0, 7);

  // A RLS já limita a dias fechados — o filtro aqui é só para a consulta não
  // depender disso silenciosamente.
  const [{ data: dias }, { data: folgas }] = await Promise.all([
    supabase
      .from("diario_obra")
      .select("data, clima")
      .eq("obra_id", obraId)
      .not("fechado_em", "is", null)
      .order("data", { ascending: false }),
    // O calendário colore dia não trabalhado: domingo ele deduz sozinho, o
    // resto vem daqui.
    supabase.from("cronograma_folgas").select("data_inicio, data_fim").eq("obra_id", obraId),
  ]);

  const todos = dias ?? [];
  const doMes: DiaCalendario[] = todos
    .filter((d) => d.data.startsWith(mesAtual))
    .map((d) => ({ data: d.data, clima: praticabilidade(d.clima) }));

  /*
   * Até onde dá para navegar.
   *
   * Para trás, o mês do registro mais antigo; para frente, o mês corrente.
   * Sem esses limites o cliente clicaria a vida inteira em meses vazios, sem
   * nada indicando que não há mais nada ali.
   */
  const primeiroMes = todos.at(-1)?.data.slice(0, 7) ?? hoje.slice(0, 7);
  const ultimoMes = hoje.slice(0, 7);
  const anterior = mesAtual > primeiroMes ? mesVizinho(mesAtual, -1) : null;
  const proximo = mesAtual < ultimoMes ? mesVizinho(mesAtual, 1) : null;

  const base = `/portal/obras/${obraId}`;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="-ml-2 mb-1"
          render={
            <Link href={base}>
              <ChevronLeft className="size-4" />
              {obra.nome}
            </Link>
          }
        />
        <h1 className="font-heading text-2xl font-semibold">Diário de obra</h1>
        <p className="text-sm text-muted-foreground">
          O registro do que aconteceu na obra, dia a dia. Clique em uma data para abrir o RDO
          completo daquele dia.
        </p>
      </div>

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
                  <Link href={`${base}/diario?mes=${anterior}`}>
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
                  <Link href={`${base}/diario?mes=${proximo}`}>
                    <ChevronRight className="size-4" />
                  </Link>
                ) : undefined
              }
            >
              {proximo ? undefined : <ChevronRight className="size-4" />}
            </Button>
          </div>

          <CalendarioDiarios
            dias={doMes}
            mesReferencia={mesAtual}
            base={base}
            hoje={hoje}
            folgas={(folgas ?? []).map((f) => ({ dataInicio: f.data_inicio, dataFim: f.data_fim }))}
            diasSemRegistroClicaveis
          />
        </CardContent>
      </Card>

      {!todos.length && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
          <NotebookPen className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">Nenhum diário publicado ainda</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Assim que o engenheiro enviar o primeiro RDO, ele aparece aqui — e o dia fica
            marcado no calendário.
          </p>
        </div>
      )}

      {!!todos.length && (
        <p className="text-center text-xs text-muted-foreground">
          Último registro: {formatDateBR(todos[0].data)}
        </p>
      )}
    </div>
  );
}
