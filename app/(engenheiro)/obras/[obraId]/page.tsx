import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { updateObraStatus } from "@/app/actions/obras";
import { Badge } from "@/components/ui/badge";
import { formatDateBR } from "@/lib/format-date";
import { formatarEndereco } from "@/lib/obra-cadastro";
import { LembretesCard } from "@/components/lembretes/lembretes-card";
import { buscarLembretes } from "@/lib/lembretes";
import { carregarVisaoGeral } from "@/lib/obras/visao-geral";
import { VisaoGeralObra } from "@/components/obras/visao-geral/visao-geral-obra";
import { buscarDadosTimeline } from "@/lib/cronograma/timeline-dados";
import { CronogramaTimeline } from "@/components/cronograma/cronograma-timeline";
import { EquipeDaObraCard, type EquipeNaObra } from "./equipe-da-obra-card";
import { AlocarTrabalhadorDialog } from "./alocar-trabalhador-dialog";
import { EditarObraDialog } from "./editar-obra-dialog";
import { assinarImagensObra } from "@/lib/obras/imagens";
import { AcessoClienteAposCadastro } from "@/components/obras/acesso-cliente-apos-cadastro";
import { Pencil } from "lucide-react";

const statusOptions = [
  { value: "planejamento", label: "Planejamento" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "pausada", label: "Pausada" },
  { value: "concluida", label: "Concluída" },
];

export default async function ObraOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ nova?: string }>;
}) {
  const { obraId } = await params;
  const { nova } = await searchParams;
  const supabase = await createClient();

  const [
    { data: obra },
    { data: clientesVinculados },
    { count: comprasCount },
    timeline,
    { data: tipos },
  ] = await Promise.all([
    supabase.from("obras").select("*, obra_tipos(nome)").eq("id", obraId).single(),
    supabase.from("obra_clientes").select("cliente_id, profiles(nome, email)").eq("obra_id", obraId),
    supabase.from("compras").select("*", { count: "exact", head: true }).eq("obra_id", obraId),
    buscarDadosTimeline(supabase, obraId),
    supabase.from("obra_tipos").select("id, nome").order("nome"),
  ]);

  // Equipes desta obra e as que ainda podem ser colocadas nela.
  const [{ data: vinculosEquipe }, { data: equipesCadastradas }, { data: alocados }, { data: trabalhadoresAtivos }] =
    await Promise.all([
      supabase
        .from("obra_equipes")
        .select(
          "equipe_id, tipo_contrato, unidade_medida, valor_unidade, equipes(nome, responsavel:trabalhadores!responsavel_id(nome), equipe_trabalhadores(trabalhadores(nome)))"
        )
        .eq("obra_id", obraId)
        .eq("ativo", true),
      supabase.from("equipes").select("id, nome").eq("ativo", true).order("nome"),
      supabase
        .from("obra_trabalhadores")
        .select("trabalhador_id, valor_diaria, trabalhadores(nome, funcao)")
        .eq("obra_id", obraId)
        .eq("ativo", true),
      supabase.from("trabalhadores").select("id, nome, funcao, valor_diaria_padrao").eq("ativo", true),
    ]);

  const nomeTipo = (obra?.obra_tipos as unknown as { nome: string } | null)?.nome ?? null;

  if (!obra) return null;

  // Só vale mostrar a timeline depois que o CPM rodou e as tarefas têm datas.
  const temTimeline = timeline.tarefas.some((t) => t.inicio && t.fim);

  const [lembretes, dadosVisao, imagens] = await Promise.all([
    buscarLembretes(supabase, { obraId }),
    carregarVisaoGeral(supabase, obraId),
    assinarImagensObra(supabase, obra),
  ]);


  const clientes = (clientesVinculados ?? []).map((v) => {
    const p = v.profiles as unknown as { nome: string; email: string | null } | null;
    return { id: v.cliente_id, nome: p?.nome ?? "—", email: p?.email ?? null };
  });

  const equipesNaObra: EquipeNaObra[] = (vinculosEquipe ?? []).map((v) => {
    const eq = v.equipes as unknown as {
      nome: string;
      responsavel: { nome: string } | null;
      equipe_trabalhadores: { trabalhadores: { nome: string } | null }[];
    } | null;
    return {
      equipeId: v.equipe_id,
      nome: eq?.nome ?? "—",
      responsavel: eq?.responsavel?.nome ?? null,
      membros: (eq?.equipe_trabalhadores ?? []).map((m) => m.trabalhadores?.nome).filter((n): n is string => !!n),
      tipoContrato: v.tipo_contrato,
      unidadeMedida: v.unidade_medida,
      valorUnidade: v.valor_unidade,
    };
  });

  const jaNaObra = new Set(equipesNaObra.map((e) => e.equipeId));
  const equipesDisponiveis = (equipesCadastradas ?? []).filter((e) => !jaNaObra.has(e.id));

  const alocadosIds = new Set((alocados ?? []).map((a) => a.trabalhador_id));
  const trabalhadoresDisponiveis = (trabalhadoresAtivos ?? []).filter((t) => !alocadosIds.has(t.id));
  const equipeCount = alocados?.length ?? 0;

  const updateStatusWithId = updateObraStatus.bind(null, obraId);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <AcessoClienteAposCadastro obraId={obraId} nova={nova === "1"} />

      {(!!lembretes.lembretes.length || !!lembretes.tarefasAtrasadas) && (
        <div className="md:col-span-3">
          <LembretesCard
            lembretes={lembretes.lembretes}
            tarefasAtrasadas={lembretes.tarefasAtrasadas}
            obraId={obraId}
          />
        </div>
      )}

      <div className="md:col-span-3">
        <VisaoGeralObra dados={dadosVisao} obraId={obraId} />
      </div>

      {temTimeline && (
        <Card className="md:col-span-3">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>Cronograma</CardTitle>
            <Button
              nativeButton={false}
              variant="outline"
              size="sm"
              render={<Link href={`/obras/${obraId}/cronograma`}>Abrir cronograma</Link>}
            />
          </CardHeader>
          <CardContent>
            <CronogramaTimeline {...timeline} alturaMaxima={340} />
          </CardContent>
        </Card>
      )}

      <Card className="md:col-span-2">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Dados da obra</CardTitle>
          <EditarObraDialog
            obra={obra}
            clientes={clientes}
            tipos={tipos ?? []}
            imagens={imagens}
          />
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Categoria</p>
              <p className="font-medium">{obra.categoria}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Tipo de obra</p>
              <p className="font-medium">{nomeTipo ?? "—"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-muted-foreground">Endereço</p>
              <p className="font-medium">{formatarEndereco(obra) ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Início previsto</p>
              <p className="font-medium">{formatDateBR(obra.data_inicio)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Fim previsto</p>
              <p className="font-medium">{formatDateBR(obra.data_fim_prevista)}</p>
            </div>
            {obra.metragem_quadrada !== null && (
              <div>
                <p className="text-muted-foreground">Metragem</p>
                <p className="font-medium">{obra.metragem_quadrada} m²</p>
              </div>
            )}
            {obra.padrao_acabamento && (
              <div>
                <p className="text-muted-foreground">Padrão de acabamento</p>
                <p className="font-medium">{obra.padrao_acabamento}</p>
              </div>
            )}
            {(obra.quartos > 0 || obra.suites > 0 || obra.banheiros > 0) && (
              <div className="sm:col-span-2">
                <p className="text-muted-foreground">Cômodos</p>
                <p className="font-medium">
                  {obra.quartos} quarto(s) · {obra.suites} suíte(s) · {obra.banheiros} banheiro(s)
                </p>
              </div>
            )}
            {obra.financiada && (
              <div className="sm:col-span-2">
                <Badge variant="secondary">Obra financiada</Badge>
              </div>
            )}
          </div>

          <form action={updateStatusWithId} className="flex flex-wrap items-end gap-2 pt-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="status" className="text-xs text-muted-foreground">
                Status da obra
              </label>
              <select
                id="status"
                name="status"
                defaultValue={obra.status}
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" size="sm" variant="outline">
              Atualizar status
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        {/* Cliente em leitura: o vínculo só se mexe na edição da obra, para não
            ser trocado por engano no uso diário. */}
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Cliente</CardTitle>
            <EditarObraDialog
              obra={obra}
              clientes={clientes}
              tipos={tipos ?? []}
              imagens={imagens}
              gatilho={
                <Button variant="ghost" size="sm">
                  <Pencil className="size-4" />
                  Editar
                </Button>
              }
            />
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {clientes.map((c) => (
              <div key={c.id}>
                <p className="font-medium">{c.nome}</p>
                <p className="truncate text-muted-foreground">{c.email ?? "—"}</p>
              </div>
            ))}
            {!clientes.length && (
              <p className="text-muted-foreground">
                Nenhum cliente vinculado — use o botão Editar acima.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <p className="text-sm text-muted-foreground">Compras registradas</p>
            <p className="font-heading text-xl font-semibold">{comprasCount ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Quem trabalha nesta obra: colaboradores alocados (com a diária daqui)
          e as equipes escolhidas do cadastro. Substitui a aba removida. */}
      <Card className="md:col-span-3">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Equipe em obra</CardTitle>
          <AlocarTrabalhadorDialog
            obraId={obraId}
            trabalhadoresDisponiveis={trabalhadoresDisponiveis}
          />
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">
              Colaboradores alocados{equipeCount ? ` (${equipeCount})` : ""}
            </p>
            {(alocados ?? []).map((a) => {
              const t = a.trabalhadores as unknown as { nome: string; funcao: string | null } | null;
              return (
                <div
                  key={a.trabalhador_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5 text-sm"
                >
                  <span>
                    {t?.nome}
                    {t?.funcao && <span className="text-muted-foreground"> · {t.funcao}</span>}
                  </span>
                  <span className="text-muted-foreground">
                    {a.valor_diaria.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    /dia
                  </span>
                </div>
              );
            })}
            {!alocados?.length && (
              <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                Nenhum colaborador alocado ainda.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Equipes</p>
            <EquipeDaObraCard
              obraId={obraId}
              equipesNaObra={equipesNaObra}
              equipesDisponiveis={equipesDisponiveis}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
