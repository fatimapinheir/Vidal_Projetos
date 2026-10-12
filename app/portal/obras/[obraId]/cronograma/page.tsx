import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
 * Sem cartões de resumo acima dela: início, previsão de término e contagem de
 * tarefas repetiam o que a própria timeline mostra, e empurravam o calendário
 * para baixo da dobra — justamente o que o cliente abriu a tela para ver.
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
    // Só para saber se há cronograma montado — os números que ficavam em
    // cartões acima da timeline saíram, e eram eles que usavam as datas.
    supabase.from("cronograma_tarefas").select("id").eq("obra_id", obraId),
  ]);

  // A regra de acesso devolve vazio para obra que não é do cliente.
  if (!obra) notFound();

  const lista = tarefas ?? [];

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
          <CronogramaTimeline {...timeline} alturaMaxima="70vh" simplificado />
        </>
      )}
    </div>
  );
}
