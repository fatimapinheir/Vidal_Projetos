"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, requireRole } from "@/lib/auth/require-role";
import { lerAnexosDoForm, salvarAnexosDaCompra } from "@/lib/compras/anexos";
import { etapaOrcamentoValida } from "@/lib/compras/etapa-orcamento";

const itemSchema = z.object({
  orcamento_item_id: z.uuid().optional(),
  /** Insumo do catálogo (0067). Ausente no item avulso. */
  insumo_id: z.uuid().optional(),
  /*
   * Cópia do catálogo, não referência — renomear ou apagar o insumo não
   * reescreve o que foi lançado. Ver a 0067.
   */
  descricao: z.string().min(1),
  unidade: z.string().min(1),
  categoria_custo: z.enum(["material", "servico", "mao_de_obra"]).optional(),
  quantidade: z.number().positive(),
  preco_unitario: z.number().nonnegative(),
  desconto_tipo: z.enum(["valor", "percentual"]).optional(),
  desconto_valor: z.number().nonnegative().optional(),
});

/** Total líquido do item, com o desconto individual aplicado. Mesma fórmula do gatilho. */
function totalLiquidoDoItem(item: z.infer<typeof itemSchema>) {
  const bruto = item.quantidade * item.preco_unitario;
  if (item.desconto_tipo === "percentual") {
    return Math.max(bruto * (1 - (item.desconto_valor ?? 0) / 100), 0);
  }
  if (item.desconto_tipo === "valor") return Math.max(bruto - (item.desconto_valor ?? 0), 0);
  return bruto;
}

/**
 * Lê os itens do formulário. Ao menos um, sempre.
 *
 * Eram opcionais, e o custo disso está nos dados: 64 dos 70 lançamentos
 * ficaram sem item nenhum, com o insumo escrito na descrição em prosa —
 * "3 telhas de 4 metros a 30 o metro / 30 parafusos a 4 reais". Texto assim
 * não soma, não filtra e não vira relatório.
 */
function lerItens(
  formData: FormData
): { error: string; itens?: undefined } | { error?: undefined; itens: z.infer<typeof itemSchema>[] } {
  const bruto = formData.get("itens");
  if (!bruto) return { error: "Adicione ao menos um item ao lançamento." };

  let itens: z.infer<typeof itemSchema>[];
  try {
    itens = z.array(itemSchema).parse(JSON.parse(String(bruto)));
  } catch {
    return { error: "Não foi possível ler os itens do lançamento." };
  }

  if (!itens.length) return { error: "Adicione ao menos um item ao lançamento." };
  return { itens };
}

const schema = z.object({
  fornecedor_id: z.uuid("Selecione um fornecedor."),
  descricao: z.string().trim().min(1, "Descreva o lançamento."),
  categoria_id: z.uuid().optional(),
  tipo_item: z.enum(["material", "servico", "mao_de_obra"]).optional(),
  nota_fiscal_numero: z.string().trim().min(1).optional(),
  nota_fiscal_emissao: z.string().min(1).optional(),
  forma_pagamento: z.enum([
    "dinheiro",
    "pix",
    "boleto",
    "cartao_credito",
    "cartao_debito",
    "transferencia",
    "cheque",
    "outro",
  ]),
  data_pagamento: z.string().min(1, "Informe a data do pagamento."),
  /*
   * Entrega, opcional — e a mesma coluna da ordem de compra.
   *
   * Lançamento é pagamento já feito, não "pagamento sem mercadoria": quem
   * paga o material no balcão e combina a entrega para quinta tem a mesma
   * pergunta de entrega que uma ordem de compra tem. Metade dos lançamentos
   * (IPTU, uma taxa) não entrega nada, e por isso o campo é opcional em vez
   * de obrigatório com data inventada.
   */
  data_entrega_prevista: z.string().min(1).optional(),
  /*
   * Entrega já recebida, vinda do checkbox do formulário.
   *
   * Nasce fechada em vez de obrigar o passo seguinte: num lançamento, pagar e
   * levar na hora é o caso comum, e exigir que a pessoa salve e depois volte
   * para confirmar o recebimento seria cerimônia por nada.
   */
  data_entrega_real: z.string().min(1).optional(),
  orcamento_etapa: z.string().min(1).optional(),
  /*
   * `valor` saiu do formulário.
   *
   * Era um campo digitado ao lado dos itens, e criava duas verdades sobre o
   * mesmo pagamento: o número escrito e a soma dos itens. Agora o total é
   * sempre a soma — calculada aqui para o insert e confirmada pelo gatilho
   * `trg_compra_itens_recalcula`, que é quem manda em `compras.valor_total`.
   */
  // O primeiro arquivo anexado. Continua obrigatório e continua indo para a
  // parcela — ver o insert da parcela, mais abaixo.
  /*
   * `null` vira string vazia antes da checagem.
   *
   * O caminho é `formData.set("comprovante_path", ...)` no navegador, e ele só
   * acontece havendo arquivo — sem anexo o campo nem existe no envio, e
   * `formData.get()` devolve `null`. `z.string()` recusaria o `null` com a
   * mensagem crua do Zod, em inglês, no lugar da frase que está escrita aqui
   * justamente para explicar o que fazer.
   */
  comprovante_path: z.preprocess(
    (v) => v ?? "",
    z.string().min(1, "Anexe o comprovante do pagamento.")
  ),
});

export type LancamentoState = { error: string | null; sucesso?: boolean };

/**
 * Registra um pagamento que já aconteceu.
 *
 * É o irmão simples da ordem de compra, e a diferença não é de tamanho de
 * formulário: a ordem de compra descreve uma compra que vai acontecer —
 * cotação, aprovação, entrega, parcelas a vencer. O lançamento descreve
 * dinheiro que já saiu. Por isso aqui não há anexo de cotação, aprovação do
 * cliente, entrega nem parcelamento, e por isso o comprovante é OBRIGATÓRIO:
 * sem ele seria uma afirmação sem lastro dentro do custo da obra.
 *
 * O cliente também pode registrar — é a única escrita financeira aberta a
 * ele. A RLS garante o resto: a policy `cli_insert_lancamento` só aceita
 * linha com `eh_lancamento` e em obra dele, então por este caminho ninguém
 * cria ordem de compra nem mexe em obra alheia.
 */
export async function criarLancamento(
  obraId: string,
  _prevState: LancamentoState,
  formData: FormData
): Promise<LancamentoState> {
  const profile = await requireAuth();

  const parsed = schema.safeParse({
    fornecedor_id: formData.get("fornecedor_id"),
    descricao: formData.get("descricao"),
    categoria_id: formData.get("categoria_id") || undefined,
    tipo_item: formData.get("tipo_item") || undefined,
    nota_fiscal_numero: formData.get("nota_fiscal_numero") || undefined,
    nota_fiscal_emissao: formData.get("nota_fiscal_emissao") || undefined,
    forma_pagamento: formData.get("forma_pagamento"),
    data_pagamento: formData.get("data_pagamento"),
    data_entrega_prevista: formData.get("data_entrega_prevista") || undefined,
    data_entrega_real: formData.get("data_entrega_real") || undefined,
    orcamento_etapa: formData.get("orcamento_etapa") || undefined,
    comprovante_path: formData.get("comprovante_path"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();

  // O nome da etapa viaja como texto; sem conferir, um valor qualquer criaria
  // etapa fantasma no comparativo orçado × gasto.
  const etapa = await etapaOrcamentoValida(supabase, obraId, parsed.data.orcamento_etapa);
  if (etapa.error) return { error: etapa.error };

  const lidos = lerItens(formData);
  if (lidos.error !== undefined) return { error: lidos.error };
  const { itens } = lidos;

  /*
   * O total nasce da soma e é confirmado pelo gatilho.
   *
   * O valor entra no insert porque `valor_total` é NOT NULL e o gatilho só
   * dispara depois, com os itens. Calculado com a mesma fórmula dele, o número
   * já nasce certo; ainda assim o valor da parcela é relido do banco mais
   * abaixo, e não deste cálculo — quem manda é o gatilho.
   */
  const totalDosItens = itens.reduce((soma, item) => soma + totalLiquidoDoItem(item), 0);
  if (totalDosItens <= 0) return { error: "O valor do lançamento precisa ser maior que zero." };

  const { data: compra, error } = await supabase
    .from("compras")
    .insert({
      obra_id: obraId,
      fornecedor_id: parsed.data.fornecedor_id,
      descricao: parsed.data.descricao,
      valor_total: totalDosItens,
      forma_pagamento: parsed.data.forma_pagamento,
      categoria_id: parsed.data.categoria_id ?? null,
      tipo_item: parsed.data.tipo_item ?? null,
      nota_fiscal_numero: parsed.data.nota_fiscal_numero ?? null,
      nota_fiscal_emissao: parsed.data.nota_fiscal_emissao ?? null,
      orcamento_etapa: etapa.nome,
      data_entrega_prevista: parsed.data.data_entrega_prevista ?? null,
      data_entrega_real: parsed.data.data_entrega_real ?? null,
      // Quem marcou o checkbox é quem está registrando — a mesma dupla de
      // colunas que `confirmarRecebimentoOrdem` preenche depois.
      recebimento_confirmado_por: parsed.data.data_entrega_real ? profile.id : null,
      recebimento_confirmado_em: parsed.data.data_entrega_real ? new Date().toISOString() : null,
      eh_lancamento: true,
      // Já pago: nasce aprovado e sem exigir aprovação de ninguém.
      status: "paga",
      requer_aprovacao_cliente: false,
      pagamento_apos_recebimento: false,
      data_cotacao: parsed.data.data_pagamento,
      aprovado_por: profile.id,
      aprovado_em: new Date().toISOString(),
      criado_por: profile.id,
    })
    .select("id")
    .single();

  if (error || !compra) return { error: "Não foi possível registrar o lançamento." };

  const erroAnexos = await salvarAnexosDaCompra(
    supabase,
    compra.id,
    "comprovantes-pagamento",
    lerAnexosDoForm(formData),
    profile.id
  );
  if (erroAnexos) return { error: erroAnexos };

  const { error: erroItens } = await supabase.from("compra_itens").insert(
    itens.map((item, i) => ({
      compra_id: compra.id,
      orcamento_item_id: item.orcamento_item_id ?? null,
      insumo_id: item.insumo_id ?? null,
      descricao: item.descricao,
      unidade: item.unidade,
      categoria_custo: item.categoria_custo ?? null,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
      desconto_tipo: item.desconto_tipo ?? null,
      desconto_valor: item.desconto_valor ?? null,
      ordem: i + 1,
    }))
  );
  if (erroItens) return { error: "Não foi possível salvar os itens do lançamento." };

  // Relê o total já recalculado pelo gatilho: é ele que a parcela precisa
  // espelhar — senão o pagamento diria um número e a soma dos itens diria
  // outro.
  const { data: atualizada } = await supabase
    .from("compras")
    .select("valor_total")
    .eq("id", compra.id)
    .single();
  const valorFinal = atualizada?.valor_total ?? totalDosItens;

  /*
   * Uma parcela, já paga.
   *
   * Poderia não haver parcela nenhuma, mas tudo que soma dinheiro no sistema
   * lê `compra_parcelas` — total gasto, rosca de categorias, lista do
   * cliente. Um lançamento sem parcela seria invisível em todos eles.
   */
  const { error: erroParcela } = await supabase.from("compra_parcelas").insert({
    compra_id: compra.id,
    numero_parcela: 1,
    valor: valorFinal,
    data_vencimento: parsed.data.data_pagamento,
    data_pagamento: parsed.data.data_pagamento,
    status: "paga",
    /*
     * O primeiro anexo também fica aqui, duplicando o caminho que já está em
     * `compra_anexos`.
     *
     * De propósito: tudo que trata de pagamento no sistema lê o comprovante
     * NA PARCELA — a tabela de parcelas da tela de detalhe, a limpeza de
     * arquivos da obra, os lançamentos já registrados antes desta mudança.
     * Deixar a parcela sem comprovante faria um pagamento pago aparecer sem
     * prova em todas essas telas.
     */
    comprovante_pagamento_path: parsed.data.comprovante_path,
  });

  if (erroParcela) {
    return { error: "Lançamento criado, mas houve erro ao gravar o pagamento." };
  }

  revalidatePath(`/obras/${obraId}/compras`);
  revalidatePath(`/portal/obras/${obraId}/compras`);
  revalidatePath(`/portal/obras/${obraId}`);
  revalidatePath(`/obras/${obraId}`);
  return { error: null, sucesso: true };
}

/** Os mesmos campos da criação, menos o comprovante — ele é gerido no detalhe. */
const schemaEdicao = schema.omit({ comprovante_path: true });

/**
 * Edita um lançamento já registrado.
 *
 * Existe porque um lançamento nascia congelado: errar o valor, a data ou o
 * fornecedor obrigava a excluir e digitar tudo de novo, destruindo o registro
 * financeiro por causa de um dígito. Corrigir é mais barato e mais honesto que
 * recriar.
 *
 * Só o engenheiro edita. O cliente registra o lançamento dele e pode anexar e
 * excluir o próprio — mas mudar valor depois de lançado é outra conversa, e
 * daria a ele um poder que a RLS hoje nega de propósito (ver 0049: nem update
 * de `compras` ele tem).
 *
 * Os itens são apagados e regravados em vez de casados um a um: a lista chega
 * inteira do formulário, sem identidade estável, e tentar adivinhar quem é
 * quem erraria em silêncio. Quem recalcula o total continua sendo o gatilho.
 */
export async function atualizarLancamento(
  compraId: string,
  _prevState: LancamentoState,
  formData: FormData
): Promise<LancamentoState> {
  await requireRole("engenheiro");

  const parsed = schemaEdicao.safeParse({
    fornecedor_id: formData.get("fornecedor_id"),
    descricao: formData.get("descricao"),
    categoria_id: formData.get("categoria_id") || undefined,
    tipo_item: formData.get("tipo_item") || undefined,
    nota_fiscal_numero: formData.get("nota_fiscal_numero") || undefined,
    nota_fiscal_emissao: formData.get("nota_fiscal_emissao") || undefined,
    forma_pagamento: formData.get("forma_pagamento"),
    data_pagamento: formData.get("data_pagamento"),
    data_entrega_prevista: formData.get("data_entrega_prevista") || undefined,
    data_entrega_real: formData.get("data_entrega_real") || undefined,
    orcamento_etapa: formData.get("orcamento_etapa") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();

  const { data: compra } = await supabase
    .from("compras")
    .select("id, obra_id, eh_lancamento, recebimento_confirmado_por")
    .eq("id", compraId)
    .maybeSingle();

  if (!compra) return { error: "Lançamento não encontrado." };
  if (!compra.eh_lancamento) {
    return { error: "Este registro é uma ordem de compra, não um lançamento." };
  }

  const etapa = await etapaOrcamentoValida(supabase, compra.obra_id, parsed.data.orcamento_etapa);
  if (etapa.error) return { error: etapa.error };

  const lidos = lerItens(formData);
  if (lidos.error !== undefined) return { error: lidos.error };
  const { itens } = lidos;

  const totalDosItens = itens.reduce((soma, item) => soma + totalLiquidoDoItem(item), 0);
  if (totalDosItens <= 0) return { error: "O valor do lançamento precisa ser maior que zero." };

  const { error: erroCompra } = await supabase
    .from("compras")
    .update({
      fornecedor_id: parsed.data.fornecedor_id,
      descricao: parsed.data.descricao,
      forma_pagamento: parsed.data.forma_pagamento,
      categoria_id: parsed.data.categoria_id ?? null,
      tipo_item: parsed.data.tipo_item ?? null,
      orcamento_etapa: etapa.nome,
      nota_fiscal_numero: parsed.data.nota_fiscal_numero ?? null,
      nota_fiscal_emissao: parsed.data.nota_fiscal_emissao ?? null,
      data_cotacao: parsed.data.data_pagamento,
      data_entrega_prevista: parsed.data.data_entrega_prevista ?? null,
      data_entrega_real: parsed.data.data_entrega_real ?? null,
      // Quem confirmou só faz sentido enquanto há entrega confirmada.
      recebimento_confirmado_por: parsed.data.data_entrega_real
        ? compra.recebimento_confirmado_por
        : null,
      recebimento_confirmado_em: parsed.data.data_entrega_real ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", compraId);

  if (erroCompra) return { error: "Não foi possível salvar as alterações." };

  const { error: erroApagar } = await supabase
    .from("compra_itens")
    .delete()
    .eq("compra_id", compraId);
  if (erroApagar) return { error: "Não foi possível atualizar os itens." };

  /*
   * O ramo "sem itens" deixou de existir.
   *
   * Ele apagava o desconto da nota e regravava o valor digitado em duas etapas,
   * porque um lançamento podia não ter item nenhum. Com item obrigatório, o
   * total é sempre a soma e o gatilho sempre dispara — a acrobacia saiu junto
   * com a possibilidade que a justificava.
   */
  const { error: erroItens } = await supabase.from("compra_itens").insert(
    itens.map((item, i) => ({
      compra_id: compraId,
      orcamento_item_id: item.orcamento_item_id ?? null,
      insumo_id: item.insumo_id ?? null,
      descricao: item.descricao,
      unidade: item.unidade,
      categoria_custo: item.categoria_custo ?? null,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
      desconto_tipo: item.desconto_tipo ?? null,
      desconto_valor: item.desconto_valor ?? null,
      ordem: i + 1,
    }))
  );
  if (erroItens) return { error: "Não foi possível salvar os itens do lançamento." };

  const { data: atualizada } = await supabase
    .from("compras")
    .select("valor_total")
    .eq("id", compraId)
    .single();
  const valorFinal = atualizada?.valor_total ?? totalDosItens;

  // A parcela espelha o lançamento: valor e data têm de andar junto, senão a
  // lista de pagamentos mostra um número que a tela de detalhe desmente.
  const { error: erroParcela } = await supabase
    .from("compra_parcelas")
    .update({
      valor: valorFinal,
      data_vencimento: parsed.data.data_pagamento,
      data_pagamento: parsed.data.data_pagamento,
      updated_at: new Date().toISOString(),
    })
    .eq("compra_id", compraId);

  if (erroParcela) {
    return { error: "Alterações salvas, mas houve erro ao atualizar o pagamento." };
  }

  revalidatePath(`/obras/${compra.obra_id}/compras`);
  revalidatePath(`/obras/${compra.obra_id}/compras/${compraId}`);
  revalidatePath(`/obras/${compra.obra_id}`);
  revalidatePath(`/portal/obras/${compra.obra_id}/compras`);
  revalidatePath(`/portal/obras/${compra.obra_id}/compras/${compraId}`);
  revalidatePath(`/portal/obras/${compra.obra_id}`);
  return { error: null, sucesso: true };
}
