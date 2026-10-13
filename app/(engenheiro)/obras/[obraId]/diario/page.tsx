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
  searchParams: Promise<{ pagina?: string }>;
}) {
  const { obraId } = await params;
  const { pagina: paginaParam } = await searchParams;
  const supabase = await createClient();
  const hoje = hojeIso();

  const { count } = await supabase
    .from("diario_obra")
    .select("data", { count: "exact", head: true })
    .eq("obra_id", obraId);

  const total = count ?? 0;
  const { pagina, de, ate } = faixaDaPagina(lerPagina(paginaParam), total);

  const [{ data: dias }, { count: diasDeHoje }] = await Promise.all([
    supabase
      .from("diario_obra")
      .select("data, clima, atividades, ocorrencias, fechado_em")
      .eq("obra_id", obraId)
      .order("data", { ascending: false })
      .range(de, ate),
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
  ]);

  const temHoje = (diasDeHoje ?? 0) > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-lg font-semibold">Diário de obra</h1>
          <p className="text-sm text-muted-foreground">
            Uma folha por dia. O efetivo, os equipamentos em obra, as tarefas previstas no
            cronograma e as entregas de material já vêm preenchidos das outras telas — você escreve o
            clima, as atividades, as ocorrências e as visitas. Ao{" "}
            <strong>fechar o dia</strong>, esse conteúdo congela, a folha vira documento e o cliente
            passa a vê-la no portal dele.
          </p>
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
        caminho={`/obras/${obraId}/diario`}
        rotulo="dias"
      />
    </div>
  );
}
