import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";
import { formatDateBR } from "@/lib/format-date";
import { conteudoParaExibir } from "@/lib/diario/montar-dia";
import { ConteudoDiaSecoes } from "@/components/diario/conteudo-dia";
import type { DiarioClima } from "@/lib/types/database.types";

const ISO_DATA = /^\d{4}-\d{2}-\d{2}$/;

const climaLabel: Record<DiarioClima, string> = {
  praticavel: "Praticável",
  chuva: "Chuva",
  impraticavel: "Impraticável",
};

function Texto({ titulo, valor }: { titulo: string; valor: string | null }) {
  if (!valor) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="whitespace-pre-wrap text-sm">{valor}</p>
    </div>
  );
}

export default async function PortalDiarioDiaPage({
  params,
}: {
  params: Promise<{ obraId: string; data: string }>;
}) {
  const { obraId, data } = await params;
  if (!ISO_DATA.test(data)) notFound();

  const supabase = await createClient();

  // A RLS entrega null para dia aberto — o cliente não descobre nem que existe.
  const { data: diario } = await supabase
    .from("diario_obra")
    .select("*")
    .eq("obra_id", obraId)
    .eq("data", data)
    .maybeSingle();

  if (!diario) notFound();

  const [conteudo, { data: fotos }] = await Promise.all([
    conteudoParaExibir(supabase, obraId, data, diario),
    supabase.from("diario_fotos").select("id, path, legenda").eq("diario_id", diario.id).order("created_at"),
  ]);

  const fotosComUrl = await Promise.all(
    (fotos ?? []).map(async (foto) => {
      const { data: assinada } = await supabase.storage
        .from("diario-obra")
        .createSignedUrl(foto.path, 60 * 10);
      return { ...foto, url: assinada?.signedUrl ?? null };
    })
  );

  const climas = [
    { label: "Manhã", valor: diario.clima_manha },
    { label: "Tarde", valor: diario.clima_tarde },
    { label: "Noite", valor: diario.clima_noite },
  ].filter((c) => c.valor);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="-ml-2 mb-1"
          render={
            <Link href={`/portal/obras/${obraId}/diario`}>
              <ChevronLeft className="size-4" />
              Todos os dias
            </Link>
          }
        />
        <h1 className="font-heading text-lg font-semibold">Diário de {formatDateBR(data)}</h1>
        {!!climas.length && (
          <p className="text-sm text-muted-foreground">
            {climas.map((c) => `${c.label}: ${climaLabel[c.valor!]}`).join(" · ")}
          </p>
        )}
      </div>

      <ConteudoDiaSecoes conteudo={conteudo} />

      {(diario.atividades || diario.ocorrencias || diario.visitas) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Registro do dia</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Texto titulo="Atividades executadas" valor={diario.atividades} />
            <Texto titulo="Ocorrências" valor={diario.ocorrencias} />
            <Texto titulo="Visitas" valor={diario.visitas} />
          </CardContent>
        </Card>
      )}

      {!!fotosComUrl.length && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Fotos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {fotosComUrl.map((foto) => (
                <figure key={foto.id} className="overflow-hidden rounded-lg border">
                  {foto.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={foto.url}
                      alt={foto.legenda ?? "Foto do diário de obra"}
                      className="aspect-4/3 w-full object-cover"
                    />
                  )}
                  {foto.legenda && (
                    <figcaption className="p-2 text-xs text-muted-foreground">
                      {foto.legenda}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
