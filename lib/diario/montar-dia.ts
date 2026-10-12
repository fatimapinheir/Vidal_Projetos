import type { createClient } from "@/lib/supabase/server";
import type { PresencaStatus } from "@/lib/types/database.types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type EfetivoItem = {
  /**
   * Id do trabalhador — existe só no dia aberto, para confirmar presença na
   * própria folha. No congelado a linha é histórica e não aceita mais ação.
   */
  trabalhadorId?: string;
  nome: string;
  /** Opcional porque snapshots gravados antes desta coluna não têm o campo. */
  funcao?: string | null;
  /** `null` = pessoa da equipe sem presença lançada nesse dia ainda. */
  status: PresencaStatus | null;
  observacoes?: string | null;
};
export type EquipamentoItem = { equipamento: string; quantidade: number; locador: string };
export type TarefaItem = { nome: string; etapa: string; critica: boolean };
export type EntregaItem = {
  /**
   * Id da ORDEM — só existe no dia aberto; no congelado a linha é histórica.
   *
   * Era o id da parcela. A entrega passou a ser da ordem (0045): a mercadoria
   * chega uma vez, e três parcelas da mesma compra geravam três linhas
   * idênticas no diário, cada uma com o seu botão de confirmar.
   */
  compraId?: string;
  descricao: string;
  fornecedor: string;
  recebidoEm: string | null;
};

export type ConteudoDia = {
  efetivo: EfetivoItem[];
  equipamentos: EquipamentoItem[];
  tarefas: TarefaItem[];
  entregas: EntregaItem[];
};

const VAZIO: ConteudoDia = { efetivo: [], equipamentos: [], tarefas: [], entregas: [] };

/**
 * Quem de fato entra no documento: só linha com presença lançada.
 *
 * O efetivo do dia aberto traz a equipe inteira, inclusive quem ainda não foi
 * confirmado, para dar onde clicar. Isso é apoio ao preenchimento, não
 * declaração — se vazasse para o RDO ou para o snapshot, o relatório afirmaria
 * que havia gente em obra sem ninguém ter dito isso.
 */
export function efetivoConfirmado(efetivo: EfetivoItem[]): EfetivoItem[] {
  return efetivo.filter((pessoa) => !!pessoa.status);
}

/**
 * Monta o que o sistema já sabe sobre um dia da obra, buscando em presenças,
 * locações, cronograma e parcelas de compra. Usado só enquanto o dia está
 * aberto — depois de fechado, o conteúdo vem dos snapshots gravados.
 */
export async function derivarConteudoDia(
  supabase: SupabaseClient,
  obraId: string,
  data: string
): Promise<ConteudoDia> {
  const [
    { data: alocados },
    { data: presencas },
    { data: locacoes },
    { data: tarefas },
    { data: entregasDoDia },
  ] =
    await Promise.all([
      // A equipe ativa da obra entra no efetivo mesmo sem presença lançada: é
      // ela que dá as linhas para confirmar o dia sem sair da folha.
      supabase
        .from("obra_trabalhadores")
        .select("trabalhador_id, trabalhadores(id, nome, funcao)")
        .eq("obra_id", obraId)
        .eq("ativo", true),
      supabase
        .from("presencas")
        .select("trabalhador_id, status, observacoes, trabalhadores(nome, funcao)")
        .eq("obra_id", obraId)
        .eq("data", data),
      supabase
        .from("locacoes_equipamento")
        .select("equipamento, quantidade, fornecedores(nome)")
        .eq("obra_id", obraId)
        .lte("data_inicio", data)
        .or(`data_devolucao.is.null,data_devolucao.gte.${data}`),
      supabase
        .from("cronograma_tarefas")
        .select("nome, critica, cronograma_etapas(nome)")
        .eq("obra_id", obraId)
        .lte("data_inicio_cedo", data)
        .gte("data_fim_cedo", data),
      supabase
        .from("compras")
        .select("id, descricao, data_entrega_real, fornecedores(nome)")
        .eq("obra_id", obraId)
        .eq("data_entrega_prevista", data),
    ]);

  // Equipe primeiro, presenças por cima. Nessa ordem porque a presença manda:
  // quem foi lançado e depois saiu da equipe continua no dia em que trabalhou.
  const porTrabalhador = new Map<string, EfetivoItem>();

  for (const alocacao of alocados ?? []) {
    const pessoa = alocacao.trabalhadores as unknown as {
      id: string;
      nome: string;
      funcao: string | null;
    } | null;
    if (!pessoa) continue;
    porTrabalhador.set(pessoa.id, {
      trabalhadorId: pessoa.id,
      nome: pessoa.nome,
      funcao: pessoa.funcao,
      status: null,
    });
  }

  for (const presenca of presencas ?? []) {
    const pessoa = presenca.trabalhadores as unknown as {
      nome: string;
      funcao: string | null;
    } | null;
    const daEquipe = porTrabalhador.get(presenca.trabalhador_id);
    porTrabalhador.set(presenca.trabalhador_id, {
      trabalhadorId: presenca.trabalhador_id,
      nome: daEquipe?.nome ?? pessoa?.nome ?? "—",
      funcao: daEquipe?.funcao ?? pessoa?.funcao ?? null,
      status: presenca.status,
      observacoes: presenca.observacoes,
    });
  }

  return {
    efetivo: [...porTrabalhador.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),

    equipamentos: (locacoes ?? []).map((l) => {
      const fornecedor = l.fornecedores as unknown as { nome: string } | null;
      return {
        equipamento: l.equipamento,
        quantidade: l.quantidade,
        locador: fornecedor?.nome ?? "—",
      };
    }),

    tarefas: (tarefas ?? []).map((t) => {
      const etapa = t.cronograma_etapas as unknown as { nome: string } | null;
      return { nome: t.nome, etapa: etapa?.nome ?? "—", critica: t.critica };
    }),

    entregas: (entregasDoDia ?? []).map((c) => {
      const fornecedor = c.fornecedores as unknown as { nome: string } | null;
      return {
        compraId: c.id,
        descricao: c.descricao,
        fornecedor: fornecedor?.nome ?? "—",
        recebidoEm: c.data_entrega_real,
      };
    }),
  };
}

/**
 * Conteúdo do dia para exibição: os snapshots quando a folha está fechada, o
 * estado atual das outras telas quando ainda está aberta. É a única função que
 * decide isso — telas e actions não devem escolher por conta própria, senão uma
 * folha fechada acabaria mostrando dado novo em algum canto.
 */
export async function conteudoParaExibir(
  supabase: SupabaseClient,
  obraId: string,
  data: string,
  diario: {
    fechado_em: string | null;
    efetivo_snapshot: unknown;
    equipamentos_snapshot: unknown;
    tarefas_snapshot: unknown;
    entregas_snapshot: unknown;
  } | null
): Promise<ConteudoDia> {
  if (!diario) return derivarConteudoDia(supabase, obraId, data);

  if (!diario.fechado_em) return derivarConteudoDia(supabase, obraId, data);

  return {
    efetivo: (diario.efetivo_snapshot as EfetivoItem[] | null) ?? [],
    equipamentos: (diario.equipamentos_snapshot as EquipamentoItem[] | null) ?? [],
    tarefas: (diario.tarefas_snapshot as TarefaItem[] | null) ?? [],
    entregas: (diario.entregas_snapshot as EntregaItem[] | null) ?? [],
  };
}

export { VAZIO as conteudoVazio };
