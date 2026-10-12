import type { createClient } from "@/lib/supabase/server";
import { hojeIso } from "@/lib/locacoes/calculo";
import { horaNoFuso } from "@/lib/fuso";
import type { DiarioCondicao, PresencaStatus } from "@/lib/types/database.types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type TarefaDaSemana = {
  id: string;
  nome: string;
  etapa: string;
  inicio: string | null;
  fim: string | null;
  concluida: boolean;
};

export type RdoDeHoje = {
  data: string;
  atividades: string | null;
  /** As atividades quebradas em linhas, para virarem lista na tela. */
  linhasDeAtividade: string[];
  fotos: number;
  /**
   * Condição do tempo e temperatura são INDEPENDENTES no diário.
   *
   * O engenheiro pode preencher uma e não a outra — e preenche: há dias com
   * 39°C registrados e nenhuma condição marcada. Guardar as duas deixa o
   * cartão dizer o que sabe em vez de ficar mudo porque faltou um campo.
   */
  clima: DiarioCondicao | null;
  temperatura: number | null;
  /** Quantas pessoas de fato estiveram na obra, do snapshot do dia. */
  pessoasNaObra: number;
  /** Quantas constavam na equipe — o "previsto" ao lado do realizado. */
  pessoasPrevistas: number;
};

/** Quanto foi orçado em cada frente, para comparar com o que já se pagou. */
export type OrcadoPorTipo = { material: number; maoDeObra: number; servico: number };

/** Uma etapa do cronograma vista de longe: o passo da trilha na tela inicial. */
export type EtapaResumo = {
  id: string;
  nome: string;
  ordem: number;
  total: number;
  concluidas: number;
  /** "concluida" | "andamento" | "a_iniciar" — já resolvido aqui. */
  situacao: "concluida" | "andamento" | "a_iniciar";
  percentual: number;
};

export type DadosClienteExtra = {
  /** Domingo e sábado da semana corrente. */
  semana: { inicio: string; fim: string };
  tarefasDaSemana: TarefaDaSemana[];
  /** Quantas frentes de serviço estão abertas hoje. */
  frentesHoje: number;
  /** O diário de hoje, quando o engenheiro já fechou. */
  rdoDeHoje: RdoDeHoje | null;
  orcadoPorTipo: OrcadoPorTipo;
  etapas: EtapaResumo[];
  /** Folgas da obra — o calendário precisa delas para saber o que é dia útil. */
  folgas: { dataInicio: string; dataFim: string }[];
  hoje: string;
};

function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * As atividades do dia viram lista.
 *
 * O engenheiro digita num campo de texto livre, e o que sai de lá é uma linha
 * só ou um parágrafo com quebras. Como lista cabem três no cartão; como
 * parágrafo, o cartão ou estoura ou corta no meio de uma frase.
 */
function quebrarAtividades(texto: string | null): string[] {
  if (!texto) return [];
  return texto
    .split(/\r?\n|;/)
    .map((linha) => linha.replace(/^[-•*\d.)\s]+/, "").trim())
    .filter(Boolean);
}

/**
 * O que a visão do cliente precisa além dos números da obra.
 *
 * A semana corrente é de domingo a sábado — a semana do calendário, que é como
 * se combina visita e entrega de material, não "sete dias a partir de hoje".
 */
export async function carregarExtraCliente(
  supabase: SupabaseClient,
  obraId: string
): Promise<DadosClienteExtra> {
  const hoje = hojeIso();
  const diaDaSemana = new Date(`${hoje}T00:00:00Z`).getUTCDay();
  const inicioSemana = somarDias(hoje, -diaDaSemana);
  const fimSemana = somarDias(inicioSemana, 6);

  const [
    { data: tarefas },
    { data: diario },
    { data: itens },
    { data: todasTarefas },
    { data: folgas },
  ] = await Promise.all([
    supabase
      .from("cronograma_tarefas")
      .select("id, nome, data_inicio_cedo, data_fim_cedo, data_fim_real, cronograma_etapas(nome)")
      .eq("obra_id", obraId)
      .lte("data_inicio_cedo", fimSemana)
      .gte("data_fim_cedo", inicioSemana)
      .order("data_inicio_cedo"),
    // A regra de acesso só devolve dia fechado — rascunho do engenheiro não
    // chega aqui, e é isso que faz "aguardando o envio" ser verdade.
    supabase
      .from("diario_obra")
      .select("data, atividades, clima, temperatura, efetivo_snapshot")
      .eq("obra_id", obraId)
      .eq("data", hoje)
      .maybeSingle(),
    // Orçado por frente: é o denominador das barras de "executado x pago".
    // Sem ele, "materiais pagos: 55%" não teria de que ser 55%. Só a versão
    // ATIVA conta — rascunho é trabalho em andamento do engenheiro.
    supabase
      .from("orcamento_itens")
      .select("preco_total, tipo_item, orcamento_versoes!inner(obra_id, status)")
      .eq("orcamento_versoes.obra_id", obraId)
      .eq("orcamento_versoes.status", "ativa"),
    // Todas as tarefas, para montar a trilha de etapas da tela inicial.
    supabase
      .from("cronograma_tarefas")
      .select("id, data_inicio_cedo, data_fim_real, cronograma_etapas(id, nome, ordem)")
      .eq("obra_id", obraId),
    supabase
      .from("cronograma_folgas")
      .select("data_inicio, data_fim")
      .eq("obra_id", obraId),
    ]);

  const { count: fotos } = diario
    ? await supabase
        .from("diario_fotos")
        .select("id", { count: "exact", head: true })
        .eq("obra_id", obraId)
    : { count: 0 };

  const orcadoPorTipo: OrcadoPorTipo = { material: 0, maoDeObra: 0, servico: 0 };
  for (const item of itens ?? []) {
    const valor = item.preco_total ?? 0;
    if (item.tipo_item === "material") orcadoPorTipo.material += valor;
    else if (item.tipo_item === "mao_de_obra") orcadoPorTipo.maoDeObra += valor;
    else orcadoPorTipo.servico += valor;
  }

  const efetivo = (diario?.efetivo_snapshot ?? []) as { status: PresencaStatus | null }[];

  /*
   * A trilha de etapas: concluída, em andamento, a iniciar.
   *
   * "Em andamento" é etapa que já tem tarefa concluída mas não todas, OU cuja
   * primeira tarefa já deveria ter começado. O segundo caso importa: sem ele,
   * a etapa que acabou de começar aparece como "a iniciar" e o cliente acha
   * que a obra parou.
   */
  const porEtapa = new Map<string, EtapaResumo>();
  for (const t of todasTarefas ?? []) {
    const etapa = t.cronograma_etapas as unknown as {
      id: string;
      nome: string;
      ordem: number;
    } | null;
    if (!etapa) continue;
    const atual =
      porEtapa.get(etapa.id) ??
      ({
        id: etapa.id,
        nome: etapa.nome,
        ordem: etapa.ordem,
        total: 0,
        concluidas: 0,
        situacao: "a_iniciar",
        percentual: 0,
      } satisfies EtapaResumo);
    atual.total += 1;
    if (t.data_fim_real) atual.concluidas += 1;
    else if ((t.data_inicio_cedo ?? "9999") <= hoje) atual.situacao = "andamento";
    porEtapa.set(etapa.id, atual);
  }
  const etapas = [...porEtapa.values()]
    .map((e) => ({
      ...e,
      percentual: e.total ? Math.round((e.concluidas / e.total) * 100) : 0,
      situacao:
        e.total > 0 && e.concluidas === e.total
          ? ("concluida" as const)
          : e.concluidas > 0
            ? ("andamento" as const)
            : e.situacao,
    }))
    .sort((a, b) => a.ordem - b.ordem);

  return {
    hoje,
    semana: { inicio: inicioSemana, fim: fimSemana },
    tarefasDaSemana: (tarefas ?? []).map((t) => {
      const etapa = t.cronograma_etapas as unknown as { nome: string } | null;
      return {
        id: t.id,
        nome: t.nome,
        etapa: etapa?.nome ?? "",
        inicio: t.data_inicio_cedo,
        fim: t.data_fim_cedo,
        concluida: !!t.data_fim_real,
      };
    }),
    // Frente de serviço aberta hoje: tarefa que já começou, ainda não terminou
    // e cuja janela cobre o dia.
    frentesHoje: (tarefas ?? []).filter(
      (t) =>
        !t.data_fim_real &&
        (t.data_inicio_cedo ?? "9999") <= hoje &&
        (t.data_fim_cedo ?? "") >= hoje
    ).length,
    orcadoPorTipo,
    etapas,
    folgas: (folgas ?? []).map((f) => ({ dataInicio: f.data_inicio, dataFim: f.data_fim })),
    rdoDeHoje: diario
      ? {
          data: diario.data,
          atividades: diario.atividades,
          linhasDeAtividade: quebrarAtividades(diario.atividades),
          fotos: fotos ?? 0,
          clima: diario.clima,
          temperatura: diario.temperatura,
          // Meia diária conta como pessoa na obra: ela esteve lá.
          pessoasNaObra: efetivo.filter((p) => p.status && p.status !== "falta").length,
          pessoasPrevistas: efetivo.length,
        }
      : null,
  };
}

/**
 * Saudação pela hora do dia, no fuso da obra.
 *
 * Usava `getHours()`, que é a hora do relógio da MÁQUINA — e a máquina é o
 * servidor do Netlify, em UTC. Às 21h no Brasil já são 00h em UTC, e o portal
 * dava "Bom dia" para quem estava jantando.
 */
export function saudacao(agora = new Date()): string {
  const hora = horaNoFuso(agora);
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

/** Primeiro nome, para a saudação não ficar protocolar. */
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}
