import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TipoItemOrcamento } from "@/lib/types/database.types";
import { praticabilidade } from "@/lib/diario/condicao";
import { calcularCustoLocacao, hojeIso } from "@/lib/locacoes/calculo";
import { ordenarParcelasPorPrioridade } from "@/lib/parcelas";
import { situacaoFinanceiraParcela, type ChaveFinanceira } from "@/lib/compras/situacao";

type Cliente = SupabaseClient<Database>;

/**
 * Tudo que a visão geral da obra mostra, numa consulta só.
 *
 * Existe para as duas telas — a do engenheiro e a do cliente — lerem os mesmos
 * números. Quando cada tela montava a própria conta, "gasto da obra" já
 * significava coisas diferentes nas duas, e quem olhasse as duas não saberia
 * qual acreditar.
 *
 * O que muda entre elas é permissão, não cálculo: o cliente simplesmente não
 * enxerga algumas linhas (folha, presenças), e o que ele pode ver em agregado
 * vem de view com predicado de acesso. Por isso esta função não recebe "quem
 * está olhando" — é a RLS que responde isso, e o resultado já chega filtrado.
 */
export type DadosVisaoGeral = Awaited<ReturnType<typeof carregarVisaoGeral>>;

/*
 * `piorClima` morava aqui: resumia manhã, tarde e noite num nível só. O diário
 * passou a ter um campo de clima por dia, então a conversão para
 * praticabilidade é direta.
 */

function diasEntre(aIso: string, bIso: string) {
  const a = new Date(`${aIso}T00:00:00Z`).getTime();
  const b = new Date(`${bIso}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export async function carregarVisaoGeral(supabase: Cliente, obraId: string) {
  const hoje = hojeIso();
  const mesAtual = hoje.slice(0, 7);
  const daquiA30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  const [
    { data: compras },
    { data: parcelasRaw },
    { data: progresso },
    { data: equipe },
    { data: locacoes },
    { data: diarios },
    { data: maoDeObra },
    { data: tarefas },
    { data: ultimoAvanco },
  ] = await Promise.all([
    supabase
      .from("compras")
      .select("id, descricao, valor_total, status, tipo_item, locacao_id, fornecedores(nome)")
      .eq("obra_id", obraId),
    supabase
      .from("vw_compra_parcelas")
      .select("*, compras!inner(obra_id, descricao)")
      .eq("compras.obra_id", obraId),
    supabase.from("vw_progresso_obra").select("*").eq("obra_id", obraId).maybeSingle(),
    supabase
      .from("vw_equipe_ativa_obra")
      .select("trabalhadores_ativos")
      .eq("obra_id", obraId)
      .maybeSingle(),
    supabase
      .from("locacoes_equipamento")
      .select(
        "equipamento, quantidade, unidade, valor_unitario, data_inicio, horas_utilizadas, data_devolucao"
      )
      .eq("obra_id", obraId),
    supabase
      .from("diario_obra")
      .select("data, clima")
      .eq("obra_id", obraId)
      .not("fechado_em", "is", null)
      .gte("data", `${mesAtual}-01`)
      .lte("data", `${mesAtual}-31`),
    // View com predicado próprio: para o cliente vem o agregado; para quem não
    // tem acesso, não vem nada.
    supabase.from("vw_custo_mao_de_obra").select("*").eq("obra_id", obraId).maybeSingle(),
    supabase
      .from("cronograma_tarefas")
      .select("nome, data_inicio_cedo, data_fim_cedo, data_fim_real, baseline_fim, critica")
      .eq("obra_id", obraId),
    supabase
      .from("avanco_registros")
      .select("data_medicao")
      .eq("obra_id", obraId)
      .order("data_medicao", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // --- Pagamentos ---
  const parcelas = parcelasRaw ?? [];

  /**
   * As faixas saem de `situacaoFinanceiraParcela`, a mesma função que desenha o
   * selo da parcela na listagem e no detalhe.
   *
   * Antes a conta era feita aqui com filtros próprios, e o resultado podia
   * discordar do selo na mesma tela — uma parcela com pagamento já lançado
   * aparecia como "Pagamento enviado" na linha e somava em "Vencido" no
   * gráfico logo acima. As cinco chaves são mutuamente exclusivas, então elas
   * particionam exatamente o total parcelado.
   *
   * Parcela aguardando mercadoria fica na própria faixa: não é cobrança, e
   * somá-la a vencer pressionaria por algo que ainda não chegou.
   */
  const somaPorSituacao = (chave: ChaveFinanceira) =>
    parcelas
      .filter((p) => situacaoFinanceiraParcela(p).chave === chave)
      .reduce((s, p) => s + p.valor, 0);

  const aguardandoRecebimento = somaPorSituacao("aguardando_recebimento");
  const vencido = somaPorSituacao("vencido");
  const aVencer = somaPorSituacao("em_dia");
  const pagoParcelas = somaPorSituacao("pago");
  const pagamentoEnviado = somaPorSituacao("pagamento_enviado");
  const proximos30 = parcelas
    .filter(
      (p) =>
        p.liberada_para_pagamento &&
        p.status_efetivo !== "paga" &&
        p.data_vencimento <= daquiA30
    )
    .reduce((s, p) => s + p.valor, 0);

  const parcelasPrioridade = ordenarParcelasPorPrioridade(
    parcelas.filter((p) => p.status_efetivo !== "paga")
  );

  // --- Entregas ---
  /*
   * Entregas pendentes, agora pela data da ORDEM.
   *
   * A view copia `compras.data_entrega_*` para cada parcela, então duas
   * parcelas da mesma compra trazem a mesma entrega — e a lista teria a
   * compra repetida. O `Map` por `compra_id` deixa uma linha por ordem, que é
   * o que "entregas previstas" sempre quis dizer.
   */
  const porOrdem = new Map<string, (typeof parcelas)[number]>();
  for (const p of parcelas) {
    if (!p.entrega_prevista_ordem || p.entrega_real_ordem) continue;
    if (!porOrdem.has(p.compra_id)) porOrdem.set(p.compra_id, p);
  }
  const entregasPendentes = [...porOrdem.values()].sort((a, b) =>
    (a.entrega_prevista_ordem ?? "").localeCompare(b.entrega_prevista_ordem ?? "")
  );
  const entregasAtrasadas = entregasPendentes.filter(
    (p) => (p.entrega_prevista_ordem ?? "") < hoje
  );

  // --- Ordens de compra ---
  const todasCompras = compras ?? [];
  const comprasAguardando = todasCompras.filter((c) => c.status === "cotada");
  const valorAguardando = comprasAguardando.reduce((s, c) => s + c.valor_total, 0);
  const valorAprovado = todasCompras
    .filter((c) => c.status === "aprovada")
    .reduce((s, c) => s + c.valor_total, 0);
  const valorPagoCompras = todasCompras
    .filter((c) => c.status === "paga")
    .reduce((s, c) => s + c.valor_total, 0);

  /*
   * --- Locações ---
   *
   * A locação MENSAL fica de fora desta conta, de propósito. O dinheiro dela
   * já está na ordem de compra que a mensalidade gerou, e essas ordens são
   * somadas em `mensalidadesDeLocacao` logo abaixo — contá-la aqui também
   * contaria o mesmo aluguel duas vezes no custo da obra.
   *
   * O filtro mora aqui, e não dentro de `calcularCustoLocacao`, porque é esta
   * tela que não pode somar — a tela de locações precisa justamente do valor
   * acumulado do mensal para o cartão "Acumulado em uso".
   */
  const custosLocacao = (locacoes ?? [])
    .filter((l) => l.unidade !== "mes")
    .map((l) =>
      calcularCustoLocacao(
        {
          quantidade: l.quantidade,
          unidade: l.unidade,
          valorUnitario: l.valor_unitario,
          dataInicio: l.data_inicio,
          horasUtilizadas: l.horas_utilizadas,
          dataDevolucao: l.data_devolucao,
        },
        hoje
      )
    );
  const custoLocacoesPorDiaria = custosLocacao.reduce((s, c) => s + c.valor, 0);

  /*
   * --- Custo da obra, repartido pelo TIPO que o engenheiro classificou ---
   *
   * Era repartido pela ORIGEM: tudo que vinha de compra caía em "materiais",
   * e "mão de obra" contava só a folha de pagamento. O resultado é que um
   * lançamento classificado como mão de obra — um pedreiro pago por fora,
   * uma empreitada — aparecia como material, e a barra de mão de obra ficava
   * em zero numa obra que já pagou mão de obra. O rótulo dizia tipo e o
   * número respondia origem.
   *
   * O total não muda: as mesmas compras continuam somando o mesmo. O que muda
   * é em qual balde cada uma cai.
   */
  const comprometidas = todasCompras.filter(
    (c) => c.status === "aprovada" || c.status === "paga"
  );

  /*
   * As ordens geradas por locação mensal saem do balde de compras.
   *
   * Elas são ordens de compra de verdade — têm parcelas, vencem, aceitam
   * comprovante —, mas o que compram é equipamento alugado, e o gráfico já tem
   * uma faixa para isso. Deixadas entre as compras, apareceriam como material
   * ou como "Outros" e o engenheiro veria o aluguel do andaime somando na
   * mesma barra do cimento. Ver `sincronizar_mensalidades_locacao` (0054).
   */
  const ordensDeLocacao = comprometidas.filter((c) => !!c.locacao_id);
  const comprasComuns = comprometidas.filter((c) => !c.locacao_id);
  const mensalidadesDeLocacao = ordensDeLocacao.reduce((s, c) => s + c.valor_total, 0);

  const somarTipo = (tipo: TipoItemOrcamento | null) =>
    comprasComuns
      .filter((c) => (c.tipo_item ?? null) === tipo)
      .reduce((s, c) => s + c.valor_total, 0);

  const gastoCompras = comprasComuns.reduce((s, c) => s + c.valor_total, 0);
  const materiais = somarTipo("material");
  const servicos = somarTipo("servico");
  const maoDeObraEmCompras = somarTipo("mao_de_obra");
  /*
   * Compra sem tipo fica num balde próprio em vez de ser empurrada para
   * materiais. Ela não pode ser comparada com nenhuma linha do orçamento, e
   * escondê-la dentro de materiais faria a comparação mentir para cima.
   */
  const semClassificacao = somarTipo(null);

  const custoLocacoes = custoLocacoesPorDiaria + mensalidadesDeLocacao;

  const custoFolha = maoDeObra?.total ?? 0;
  /** Folha mais o que foi lançado como mão de obra nas compras. */
  const custoMaoDeObra = custoFolha + maoDeObraEmCompras;
  const custoTotal = gastoCompras + custoFolha + custoLocacoes;
  const orcado = progresso?.valor_orcado_total ?? 0;
  const percentualFinanceiro = orcado > 0 ? (custoTotal / orcado) * 100 : 0;
  const percentualFisico = progresso?.percentual_fisico ?? 0;

  // --- Cronograma ---
  const listaTarefas = tarefas ?? [];
  const tarefasConcluidas = listaTarefas.filter((t) => t.data_fim_real).length;
  // Atrasada = passou da data prevista e ainda não terminou.
  const tarefasAtrasadas = listaTarefas.filter(
    (t) => !t.data_fim_real && t.data_fim_cedo && t.data_fim_cedo < hoje
  );
  const atrasoDias = tarefasAtrasadas.reduce(
    (max, t) => Math.max(max, diasEntre(t.data_fim_cedo!, hoje)),
    0
  );
  const previsaoTermino = listaTarefas
    .map((t) => t.data_fim_cedo)
    .filter((d): d is string => !!d)
    .sort()
    .at(-1) ?? null;

  const diasDiario = (diarios ?? []).map((d) => ({
    data: d.data,
    clima: praticabilidade(d.clima),
  }));

  return {
    hoje,
    mesAtual,
    // custo
    orcado,
    gastoCompras,
    materiais,
    servicos,
    semClassificacao,
    custoMaoDeObra,
    custoFolha,
    maoDeObraEmCompras,
    maoDeObraAberto: maoDeObra?.aberto ?? 0,
    custoLocacoes,
    custoTotal,
    saldoOrcamento: orcado - custoTotal,
    percentualFinanceiro,
    percentualFisico,
    ultimaMedicao: ultimoAvanco?.data_medicao ?? null,
    // pagamentos
    vencido,
    aVencer,
    pagoParcelas,
    aguardandoRecebimento,
    pagamentoEnviado,
    totalParcelado: vencido + aVencer + pagoParcelas + aguardandoRecebimento + pagamentoEnviado,
    // Lançado conta como a pagar: o dinheiro ainda não saiu confirmado.
    aPagar: vencido + aVencer + pagamentoEnviado,
    proximos30,
    parcelasPrioridade,
    // entregas
    entregasPendentes,
    entregasAtrasadas,
    // compras
    comprasAguardando,
    valorAguardando,
    valorAprovado,
    valorPagoCompras,
    // cronograma
    totalTarefas: listaTarefas.length,
    tarefasConcluidas,
    tarefasAtrasadas,
    atrasoDias,
    previsaoTermino,
    // equipe
    trabalhadoresAtivos: equipe?.trabalhadores_ativos ?? 0,
    equipamentosEmUso: custosLocacao.filter((c) => c.emUso).length,
    // diário
    diasDiario,
    diasImpraticaveis: diasDiario.filter((d) => d.clima === "impraticavel").length,
  };
}
