import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { formatDateBR } from "@/lib/format-date";

export default async function PortalDiarioPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const supabase = await createClient();

  const { data: obra } = await supabase.from("obras").select("nome").eq("id", obraId).single();
  if (!obra) notFound();

  // A RLS já limita a dias fechados — o filtro aqui é só para a query não
  // depender disso silenciosamente.
  const { data: dias } = await supabase
    .from("diario_obra")
    .select("data, atividades, ocorrencias")
    .eq("obra_id", obraId)
    .not("fechado_em", "is", null)
    .order("data", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="-ml-2 mb-1"
          render={
            <Link href={`/portal/obras/${obraId}`}>
              <ChevronLeft className="size-4" />
              {obra.nome}
            </Link>
          }
        />
        <h1 className="font-heading text-lg font-semibold">Diário de obra</h1>
        <p className="text-sm text-muted-foreground">
          O registro do que aconteceu na obra, dia a dia: quem esteve em campo, quais equipamentos,
          as condições do tempo e as atividades executadas.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {dias?.map((dia) => (
          <Link
            key={dia.data}
            href={`/portal/obras/${obraId}/diario/${dia.data}`}
            className="rounded-xl border p-3 transition-colors hover:bg-muted/50"
          >
            <p className="text-sm font-medium">{formatDateBR(dia.data)}</p>
            <p className="truncate text-xs text-muted-foreground">
              {dia.atividades || dia.ocorrencias || "Sem anotações."}
            </p>
          </Link>
        ))}
        {!dias?.length && (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhum dia publicado ainda.
          </p>
        )}
      </div>
    </div>
  );
}
