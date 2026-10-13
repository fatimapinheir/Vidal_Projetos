import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ChevronLeft, FileDown } from "lucide-react";
import { formatDateBR } from "@/lib/format-date";
import { conteudoParaExibir } from "@/lib/diario/montar-dia";
import { ConteudoDiaSecoes } from "@/components/diario/conteudo-dia";
import { EfetivoPorFuncao } from "@/components/diario/efetivo-por-funcao";
import { DiarioForm } from "./diario-form";
import {
  FecharDiaButton,
  RecebimentoToggle,
  FotosUpload,
  LegendaFoto,
  RemoverFotoButton,
  StatusDiarioBadge,
  CampoExtra,
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

  const [conteudo, { data: fotos }, { data: funcoes }, { data: efetivoFuncoes }] =
    await Promise.all([
      conteudoParaExibir(supabase, obraId, data, diario),
      diario
        ? supabase
            .from("diario_fotos")
            .select("id, path, legenda")
            .eq("diario_id", diario.id)
            .order("created_at")
        : Promise.resolve({ data: [] }),
      /*
       * Por `ordem`, não por nome.
       *
       * Alfabética é a ordem de quem procura numa lista que não conhece. Esta
       * é para quem abre o seletor dez vezes por dia: pedreiro, ajudante,
       * mestre — e não "ajudante, armador, betoneiro". As cadastradas depois
       * entram no fim e se ordenam por nome entre si.
       */
      supabase
        .from("funcoes")
        .select("id, nome")
        .eq("ativo", true)
        .order("ordem")
        .order("nome"),
      // O efetivo por função é do DIA e fica como foi digitado — não precisa de
      // congelamento no fechamento, ao contrário do que é derivado de outras
      // telas.
      diario
        ? supabase
            .from("diario_efetivo_funcoes")
            .select("funcao_id, quantidade, funcoes(nome)")
            .eq("diario_id", diario.id)
        : Promise.resolve({ data: [] }),
    ]);

  const linhasEfetivo = (efetivoFuncoes ?? [])
    .map((linha) => ({
      funcaoId: linha.funcao_id,
      funcao: (linha.funcoes as unknown as { nome: string } | null)?.nome ?? "—",
      quantidade: linha.quantidade,
    }))
    .sort((a, b) => a.funcao.localeCompare(b.funcao, "pt-BR"));


  const fotosComUrl = await Promise.all(
    (fotos ?? []).map(async (foto) => {
      const { data: assinada } = await supabase.storage
        .from("diario-obra")
        .createSignedUrl(foto.path, 60 * 10);
      return { ...foto, url: assinada?.signedUrl ?? null };
    })
  );

  const fechado = !!diario?.fechado_em;

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
          {/* Excluir não mora aqui: a lixeira está na linha da listagem, que é
              o padrão de exclusão do sistema inteiro. */}
          {diario && <FecharDiaButton obraId={obraId} data={data} fechado={fechado} />}
        </div>
      </div>

      <ConteudoDiaSecoes
        conteudo={conteudo}
        acaoEntrega={
          fechado
            ? undefined
            : (compraId, recebidoEm) => (
                <RecebimentoToggle
                  obraId={obraId}
                  data={data}
                  compraId={compraId}
                  recebidoEm={recebidoEm}
                />
              )
        }
        blocoEfetivo={
          <EfetivoPorFuncao
            obraId={obraId}
            data={data}
            responsaveis={conteudo.responsaveis}
            linhas={linhasEfetivo}
            funcoes={funcoes ?? []}
            somenteLeitura={fechado}
          />
        }
        /*
          Com o dia aberto os extras são campos; fechados, texto. Os dois
          caminhos existem porque folha fechada é documento: dá para ler o que
          foi anotado, não para reescrever.
        */
        campoEquipamentosExtras={
          fechado ? undefined : (
            <CampoExtra
              obraId={obraId}
              data={data}
              campo="equipamentos_extras"
              valor={diario?.equipamentos_extras ?? null}
              rotulo="Outros equipamentos em obra"
              exemplo={"Betoneira emprestada do Zé\nAndaime do pessoal da pintura"}
            />
          )
        }
        campoEntregasExtras={
          fechado ? undefined : (
            <CampoExtra
              obraId={obraId}
              data={data}
              campo="entregas_extras"
              valor={diario?.entregas_extras ?? null}
              rotulo="Outras entregas recebidas"
              exemplo={"20 sacos de cimento — sem ordem lançada\n1 carga de areia"}
            />
          )
        }
        equipamentosExtras={diario?.equipamentos_extras ?? null}
        entregasExtras={diario?.entregas_extras ?? null}
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
