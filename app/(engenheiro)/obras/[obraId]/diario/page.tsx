import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateBR } from "@/lib/format-date";
import { hojeIso } from "@/lib/locacoes/calculo";
import { CloudRain, Cloud, Sun, CloudOff } from "lucide-react";
import type { DiarioCondicao } from "@/lib/types/database.types";
import { AbrirDiaForm } from "./abrir-dia-form";

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
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const supabase = await createClient();

  const { data: dias } = await supabase
    .from("diario_obra")
    .select("data, clima, atividades, ocorrencias, fechado_em")
    .eq("obra_id", obraId)
    .order("data", { ascending: false });

  const hoje = hojeIso();
  const temHoje = (dias ?? []).some((d) => d.data === hoje);

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
        {dias?.map((dia) => (
          <Link
            key={dia.data}
            href={`/obras/${obraId}/diario/${dia.data}`}
            className="flex items-center justify-between gap-4 rounded-xl border p-3 transition-colors hover:bg-muted/50"
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
        ))}
        {!dias?.length && (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhum dia registrado ainda. Comece pelo diário de hoje.
          </p>
        )}
      </div>
    </div>
  );
}
