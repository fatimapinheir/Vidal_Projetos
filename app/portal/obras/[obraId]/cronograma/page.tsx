import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateBR } from "@/lib/format-date";
import { hojeIso } from "@/lib/locacoes/calculo";
import { buscarDadosTimeline } from "@/lib/cronograma/timeline-dados";
import { CronogramaTimeline } from "@/components/cronograma/cronograma-timeline";

/**
 * O cronograma como o cliente precisa ver: quando fica pronto.
 *
 * A mesma timeline do engenheiro, sem nada para editar. O dado já era liberado
 * pela regra de acesso — faltava a tela, e "quando fica pronto" é a pergunta
 * que o cliente faz toda semana.
 *
 * O que ele NÃO vê aqui é a tabela de tarefas com duração, predecessora e
 * caminho crítico: é instrumento de quem planeja. O cliente quer a fotografia
 * do andamento, não a mecânica por trás dela.
 *
 * A timeline vem no modo `simplificado`, que tira da tela tudo o que fala de
 * desvio: caminho crítico em vermelho, retângulo da linha de base e barra de
 * executado em amarelo quando passou da data. As datas são as mesmas; o que
 * sai é o veredito sobre elas, que é conversa entre engenheiro e obra.
 */
export default async function PortalCronogramaPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const supabase = await createClient();

  const [{ data: obra }, timeline, { data: tarefas }] = await Promise.all([
    supabase.from("obras").select("nome").eq("id", obraId).maybeSingle(),
    buscarDadosTimeline(supabase, obraId),
    supabase
      .from("cronograma_tarefas")
      .select("data_inicio_cedo, data_fim_cedo, data_inicio_real, data_fim_real")
      .eq("obra_id", obraId),
  ]);

  // A regra de acesso devolve vazio para obra que não é do cliente.
  if (!obra) notFound();

  const lista = tarefas ?? [];
  const hoje = hojeIso();

  const fins = lista.map((t) => t.data_fim_cedo).filter((d): d is string => !!d).sort();
  const inicios = lista.map((t) => t.data_inicio_cedo).filter((d): d is string => !!d).sort();
  const previsaoTermino = fins.at(-1) ?? null;
  const inicioObra = inicios[0] ?? null;

  const concluidas = lista.filter((t) => t.data_fim_real).length;
  const emAndamento = lista.filter(
    (t) =>
      !t.data_fim_real &&
      t.data_inicio_cedo &&
      t.data_inicio_cedo <= hoje &&
      (t.data_fim_cedo ?? "") >= hoje
  ).length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-lg font-semibold">Cronograma</h1>
        <p className="text-sm text-muted-foreground">
          As etapas da sua obra no calendário. As barras mostram o período previsto de cada frente
          de serviço; a linha vertical marca o dia de hoje.
        </p>
      </div>

      {!lista.length ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          O cronograma desta obra ainda está sendo montado.
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="py-4">
                <p className="text-sm text-muted-foreground">Início</p>
                <p className="font-heading text-xl font-semibold">{formatDateBR(inicioObra)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-sm text-muted-foreground">Previsão de término</p>
                <p className="font-heading text-xl font-semibold">
                  {formatDateBR(previsaoTermino)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-sm text-muted-foreground">Andamento</p>
                <p className="font-heading text-xl font-semibold">
                  {concluidas} de {lista.length}
                </p>
                <p className="text-xs text-muted-foreground">
                  tarefas concluídas
                  {emAndamento > 0 && (
                    <>
                      {" · "}
                      <Badge variant="outline">{emAndamento} em andamento</Badge>
                    </>
                  )}
                </p>
              </CardContent>
            </Card>
          </div>

          <CronogramaTimeline {...timeline} alturaMaxima="70vh" simplificado />
        </>
      )}
    </div>
  );
}
