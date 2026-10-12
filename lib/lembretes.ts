import type { createClient } from "@/lib/supabase/server";
import { situacaoFinanceiraParcela, type ParcelaSituacao } from "@/lib/compras/situacao";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * O que está chegando: pagamentos a vencer e tarefas a começar.
 *
 * Antes o lembrete era um campo por tarefa (`lembrete_dias_antes`) que o
 * engenheiro tinha de preencher uma a uma. Em 136 tarefas, nenhuma foi
 * preenchida — e o card do dashboard vivia vazio. Agora o lembrete é
 * DERIVADO das datas que já existem: nada a configurar, e ele aparece sozinho.
 *
 * Pagamento e tarefa têm janelas diferentes de propósito. Boleto se resolve na
 * semana; fornecedor de concreto ou esquadria se agenda com quinze dias.
 */
export const DIAS_AVISO_PAGAMENTO = 7;
export const DIAS_AVISO_TAREFA = 15;

export type Lembrete = {
  id: string;
  tipo: "pagamento" | "tarefa";
  titulo: string;
  /** Fornecedor, etapa — o que situa o item. */
  detalhe: string;
  obraId: string;
  obraNome: string;
  /** Vencimento, no pagamento; início previsto, na tarefa. */
  data: string;
  /** Negativo quando a data já passou. */
  diasRestantes: number;
  href: string;
  valor?: number;
};

function hojeIso(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

function diasEntre(deIso: string, ateIso: string): number {
  const de = new Date(`${deIso}T00:00:00Z`).getTime();
  const ate = new Date(`${ateIso}T00:00:00Z`).getTime();
  return Math.round((ate - de) / 86_400_000);
}

function somarDias(dataIso: string, dias: number): string {
  const data = new Date(`${dataIso}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

/**
 * Lembretes de uma obra, ou de todas quando `obraId` é omitido (dashboard).
 *
 * Ordena pelo que aperta primeiro: o já vencido no topo, depois o mais
 * próximo. Tipo não ordena — um boleto vencido importa mais que uma tarefa
 * que começa daqui a duas semanas, e é a data que diz isso.
 */
export type ResumoLembretes = {
  lembretes: Lembrete[];
  /**
   * Tarefas cuja data de início já passou e que ninguém registrou como
   * iniciadas. Vêm como contagem, não como lembrete: nos dados reais são 66, e
   * 66 cartões não são um aviso, são um paredão. Além disso atraso é execução
   * — o lugar de resolver é Avanço.
   */
  tarefasAtrasadas: number;
};

export async function buscarLembretes(
  supabase: SupabaseClient,
  filtro?: { obraId?: string }
): Promise<ResumoLembretes> {
  const hoje = hojeIso();
  const limitePagamento = somarDias(hoje, DIAS_AVISO_PAGAMENTO);
  const limiteTarefa = somarDias(hoje, DIAS_AVISO_TAREFA);

  let queryParcelas = supabase
    .from("vw_compra_parcelas")
    .select("*, compras!inner(obra_id, descricao, fornecedores(nome), obras(nome))")
    .lte("data_vencimento", limitePagamento);

  // Só o que ainda vai começar. Tarefa com data no passado é atraso, contado
  // à parte.
  let queryTarefas = supabase
    .from("cronograma_tarefas")
    .select("id, nome, obra_id, data_inicio_cedo, cronograma_etapas(nome), obras(nome)")
    .is("data_inicio_real", null)
    .gte("data_inicio_cedo", hoje)
    .lte("data_inicio_cedo", limiteTarefa)
    .order("data_inicio_cedo");

  let queryAtrasadas = supabase
    .from("cronograma_tarefas")
    .select("id", { count: "exact", head: true })
    .is("data_inicio_real", null)
    .lt("data_inicio_cedo", hoje);

  if (filtro?.obraId) {
    queryParcelas = queryParcelas.eq("compras.obra_id", filtro.obraId);
    queryTarefas = queryTarefas.eq("obra_id", filtro.obraId);
    queryAtrasadas = queryAtrasadas.eq("obra_id", filtro.obraId);
  }

  const [{ data: parcelas }, { data: tarefas }, { count: tarefasAtrasadas }] = await Promise.all([
    queryParcelas,
    queryTarefas,
    queryAtrasadas,
  ]);

  const lembretes: Lembrete[] = [];

  for (const parcela of parcelas ?? []) {
    /*
     * A situação vem da mesma função que desenha o selo da parcela na tela de
     * compras. Parcela paga, aguardando mercadoria ou com pagamento já
     * lançado não é lembrete: não há o que fazer com ela.
     */
    const situacao = situacaoFinanceiraParcela(parcela as ParcelaSituacao);
    if (situacao.chave !== "vencido" && situacao.chave !== "em_dia") continue;

    const compra = parcela.compras as unknown as {
      obra_id: string;
      descricao: string;
      fornecedores: { nome: string } | null;
      obras: { nome: string } | null;
    } | null;
    if (!compra) continue;

    lembretes.push({
      id: `pagamento:${parcela.id}`,
      tipo: "pagamento",
      titulo: compra.descricao,
      detalhe: `${compra.fornecedores?.nome ?? "Fornecedor"} · ${parcela.numero_parcela}ª parcela`,
      obraId: compra.obra_id,
      obraNome: compra.obras?.nome ?? "",
      data: parcela.data_vencimento,
      diasRestantes: diasEntre(hoje, parcela.data_vencimento),
      href: `/obras/${compra.obra_id}/compras/${parcela.compra_id}`,
      valor: parcela.valor,
    });
  }

  for (const tarefa of tarefas ?? []) {
    const etapa = tarefa.cronograma_etapas as unknown as { nome: string } | null;
    const obra = tarefa.obras as unknown as { nome: string } | null;

    lembretes.push({
      id: `tarefa:${tarefa.id}`,
      tipo: "tarefa",
      titulo: tarefa.nome,
      detalhe: etapa?.nome ?? "",
      obraId: tarefa.obra_id,
      obraNome: obra?.nome ?? "",
      data: tarefa.data_inicio_cedo!,
      diasRestantes: diasEntre(hoje, tarefa.data_inicio_cedo!),
      href: `/obras/${tarefa.obra_id}/cronograma`,
    });
  }

  return {
    lembretes: lembretes.sort((a, b) => a.diasRestantes - b.diasRestantes),
    tarefasAtrasadas: tarefasAtrasadas ?? 0,
  };
}
