import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ChevronLeft, FileDown } from "lucide-react";
import { formatDateBR } from "@/lib/format-date";
import { conteudoParaExibir } from "@/lib/diario/montar-dia";
import { ConteudoDiaSecoes } from "@/components/diario/conteudo-dia";
import { DiarioForm } from "./diario-form";
import {
  FecharDiaButton,
  RecebimentoToggle,
  PresencaSelect,
  ConfirmarEquipeButton,
  FotosUpload,
  LegendaFoto,
  RemoverFotoButton,
  StatusDiarioBadge,
} from "./diario-actions";

const ISO_DATA = /^\d{4}-\d{2}-\d{2}$/;

export default async function DiarioDiaPage({
  params,
}: {
  params: Promise<{ obraId: string; data: string }>;
}) {
  const { obraId, data } = await params;
  if (!ISO_DATA.test(data)) notFound();

  const supabase = await createClient();

  const { data: diario } = await supabase
    .from("diario_obra")
    .select("*")
    .eq("obra_id", obraId)
    .eq("data", data)
    .maybeSingle();

  const [conteudo, { data: fotos }] = await Promise.all([
    conteudoParaExibir(supabase, obraId, data, diario),
    diario
      ? supabase
          .from("diario_fotos")
          .select("id, path, legenda")
          .eq("diario_id", diario.id)
          .order("created_at")
      : Promise.resolve({ data: [] }),
  ]);

  const fotosComUrl = await Promise.all(
    (fotos ?? []).map(async (foto) => {
      const { data: assinada } = await supabase.storage
        .from("diario-obra")
        .createSignedUrl(foto.path, 60 * 10);
      return { ...foto, url: assinada?.signedUrl ?? null };
    })
  );

  const fechado = !!diario?.fechado_em;
  // Pessoas da equipe que ainda não têm presença lançada nesse dia. Elas
  // aparecem na folha para serem confirmadas ali, mas não entram no documento.
  const semConfirmar = fechado ? 0 : conteudo.efetivo.filter((p) => !p.status).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button
            nativeButton={false}
            variant="ghost"
            size="sm"
            className="-ml-2 mb-1"
            render={
              <Link href={`/obras/${obraId}/diario`}>
                <ChevronLeft className="size-4" />
                Todos os dias
              </Link>
            }
          />
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-lg font-semibold">Diário de {formatDateBR(data)}</h1>
            <StatusDiarioBadge
              fechadoEm={diario?.fechado_em ?? null}
              reabertoEm={diario?.reaberto_em ?? null}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {fechado
              ? "Esse dia está fechado: o conteúdo abaixo é a cópia congelada no fechamento, e o cliente já enxerga essa folha no portal dele."
              : "Enquanto o dia está aberto, efetivo, equipamentos, tarefas e entregas acompanham as outras telas. Ao fechar, tudo isso congela e a folha vira documento."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            nativeButton={false}
            variant="outline"
            size="sm"
            render={
              <Link href={`/obras/${obraId}/diario/${data}/rdo`}>
                <FileDown className="size-4" />
                Baixar RDO
              </Link>
            }
          />
          {diario && (
            <FecharDiaButton
              obraId={obraId}
              data={data}
              fechado={fechado}
              semConfirmar={semConfirmar}
            />
          )}
        </div>
      </div>

      <ConteudoDiaSecoes
        conteudo={conteudo}
        acaoEntrega={
          fechado
            ? undefined
            : (parcelaId, recebidoEm) => (
                <RecebimentoToggle
                  obraId={obraId}
                  data={data}
                  parcelaId={parcelaId}
                  recebidoEm={recebidoEm}
                />
              )
        }
        acaoEfetivo={
          fechado
            ? undefined
            : (trabalhadorId, status) => (
                <PresencaSelect
                  obraId={obraId}
                  data={data}
                  trabalhadorId={trabalhadorId}
                  status={status}
                />
              )
        }
        atalhoEfetivo={
          !fechado && semConfirmar > 0 ? (
            <ConfirmarEquipeButton obraId={obraId} data={data} semConfirmar={semConfirmar} />
          ) : null
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Registro do dia</CardTitle>
        </CardHeader>
        <CardContent>
          <DiarioForm obraId={obraId} data={data} valores={diario} somenteLeitura={fechado} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Fotos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {fotosComUrl.length ? (
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {fotosComUrl.map((foto) => (
                <figure key={foto.id} className="relative overflow-hidden rounded-lg border">
                  {foto.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={foto.url}
                      alt={foto.legenda ?? "Foto do diário de obra"}
                      className="aspect-4/3 w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-4/3 items-center justify-center text-xs text-muted-foreground">
                      Não foi possível carregar
                    </div>
                  )}
                  {fechado ? (
                    foto.legenda && (
                      <figcaption className="p-2 text-xs text-muted-foreground">
                        {foto.legenda}
                      </figcaption>
                    )
                  ) : (
                    <figcaption>
                      <LegendaFoto
                        obraId={obraId}
                        data={data}
                        fotoId={foto.id}
                        legenda={foto.legenda}
                      />
                    </figcaption>
                  )}
                  {!fechado && <RemoverFotoButton obraId={obraId} data={data} fotoId={foto.id} />}
                </figure>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma foto nesse dia.</p>
          )}

          {!diario && (
            <p className="text-sm text-muted-foreground">
              Salve o diário primeiro para poder anexar fotos.
            </p>
          )}
          {diario && !fechado && <FotosUpload obraId={obraId} data={data} />}
        </CardContent>
      </Card>
    </div>
  );
}
