import type { createClient } from "@/lib/supabase/server";
import type { PresencaStatus } from "@/lib/types/database.types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type EfetivoItem = { nome: string; status: PresencaStatus; observacoes?: string | null };
export type EquipamentoItem = { equipamento: string; quantidade: number; locador: string };
export type TarefaItem = { nome: string; etapa: string; critica: boolean };
export type EntregaItem = {
  /** Id da parcela — só existe no dia aberto; no congelado a linha é histórica. */
  parcelaId?: string;
  descricao: string;
  fornecedor: string;
  parcela: string;
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
 * Monta o que o sistema já sabe sobre um dia da obra, buscando em presenças,
 * locações, cronograma e parcelas de compra. Usado só enquanto o dia está
 * aberto — depois de fechado, o conteúdo vem dos snapshots gravados.
 */
export async function derivarConteudoDia(
  supabase: SupabaseClient,
  obraId: string,
  data: string
): Promise<ConteudoDia> {
  const [{ data: presencas }, { data: locacoes }, { data: tarefas }, { data: parcelas }] =
    await Promise.all([
      supabase
        .from("presencas")
        .select("status, observacoes, trabalhadores(nome)")
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
        .from("compra_parcelas")
        .select(
          "id, numero_parcela, data_entrega_real, compras!inner(obra_id, descricao, fornecedores(nome))"
        )
        .eq("compras.obra_id", obraId)
        .eq("data_entrega_prevista", data),
    ]);

  return {
    efetivo: (presencas ?? [])
      .map((p) => {
        const trabalhador = p.trabalhadores as unknown as { nome: string } | null;
        return { nome: trabalhador?.nome ?? "—", status: p.status, observacoes: p.observacoes };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),

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

    entregas: (parcelas ?? []).map((p) => {
      const compra = p.compras as unknown as {
        descricao: string;
        fornecedores: { nome: string } | null;
      } | null;
      return {
        parcelaId: p.id,
        descricao: compra?.descricao ?? "—",
        fornecedor: compra?.fornecedores?.nome ?? "—",
        parcela: `${p.numero_parcela}ª parcela`,
        recebidoEm: p.data_entrega_real,
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
