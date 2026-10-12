"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { getProfile } from "@/lib/auth/get-profile";
import { hojeNoFuso } from "@/lib/fuso";

const parcelaSchema = z.object({
  valor: z.coerce.number().positive("Valor da parcela deve ser positivo."),
  data_vencimento: z.string().min(1, "Informe o vencimento da parcela."),
});

const compraSchema = z.object({
  fornecedor_id: z.uuid("Selecione um fornecedor."),
  descricao: z.string().min(1, "Descreva a ordem de compra."),
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
  data_cotacao: z.string().min(1),
  // Opcional: nem toda ordem se encaixa numa categoria já cadastrada, e
  // forçar uma classificação errada é pior que não ter nenhuma.
  categoria_id: z.uuid().optional(),
  // Separado da categoria por ora: vai descer para o item, porque uma mesma
  // nota pode trazer material e serviço.
  tipo_item: z.enum(["material", "servico", "mao_de_obra"]).optional(),
  // Entrega da ORDEM. Era de cada parcela — ver a migração 0045.
  data_entrega_prevista: z.string().optional(),
  nota_fiscal_numero: z.string().trim().min(1).optional(),
  nota_fiscal_emissao: z.string().min(1).optional(),
  // Etapa do orçamento é texto livre validado contra a lista da versão ativa
  // na hora de gravar — ver `etapaOrcamentoValida`.
  orcamento_etapa: z.string().optional(),
});

const itemCompraSchema = z
  .object({
    orcamento_item_id: z.uuid().optional(),
    descricao: z.string().min(1, "Descreva o item."),
    unidade: z.string().min(1, "Informe a unidade."),
    quantidade: z.coerce.number().positive("Quantidade deve ser maior que zero."),
    preco_unitario: z.coerce.number().min(0, "Preço unitário inválido."),
    desconto_tipo: z.enum(["valor", "percentual"]).optional(),
    desconto_valor: z.coerce.number().min(0).optional(),
  })
  .refine((item) => item.desconto_tipo !== "percentual" || (item.desconto_valor ?? 0) <= 100, {
    message: "Desconto percentual não pode passar de 100%.",
    path: ["desconto_valor"],
  });

const descontoNotaSchema = z
  .object({
    desconto_tipo: z.enum(["valor", "percentual"]).optional(),
    desconto_valor: z.coerce.number().min(0).optional(),
  })
  .refine((d) => d.desconto_tipo !== "percentual" || (d.desconto_valor ?? 0) <= 100, {
    message: "Desconto percentual não pode passar de 100%.",
    path: ["desconto_valor"],
  });

function calcularTotalItem(item: {
  quantidade: number;
  preco_unitario: number;
  desconto_tipo?: "valor" | "percentual";
  desconto_valor?: number;
}) {
  const subtotal = item.quantidade * item.preco_unitario;
  if (item.desconto_tipo === "percentual") {
    return Math.max(subtotal * (1 - (item.desconto_valor ?? 0) / 100), 0);
  }
  if (item.desconto_tipo === "valor") {
    return Math.max(subtotal - (item.desconto_valor ?? 0), 0);
  }
  return subtotal;
}

export type CompraFormState = { error: string | null };

type ParcelaInput = { valor: number; data_vencimento: string };
type ParseParcelasResult = { error: string; parcelas?: undefined } | { error?: undefined; parcelas: ParcelaInput[] };

function parseParcelas(formData: FormData): ParseParcelasResult {
  const parcelas: ParcelaInput[] = [];
  let index = 0;
  while (formData.has(`parcela_valor_${index}`)) {
    const parsed = parcelaSchema.safeParse({
      valor: formData.get(`parcela_valor_${index}`),
      data_vencimento: formData.get(`parcela_vencimento_${index}`),
    });
    if (!parsed.success) {
      const message: string = parsed.error.issues[0]?.message ?? "Parcela inválida.";
      return { error: message };
    }
    parcelas.push(parsed.data);
    index += 1;
  }
  return { parcelas };
}

/**
 * Confere que a etapa escolhida existe no orçamento ativo da obra.
 *
 * A coluna é texto — a etapa do orçamento é uma string, não uma tabela — então
 * sem esta checagem um valor digitado à mão criaria uma etapa fantasma que
 * aparece no comparativo com orçado zero e ninguém sabe de onde veio.
 *
 * Aceita tanto as etapas declaradas na versão quanto as que só existem em item
 * (vindas de importação de planilha): as duas aparecem na tela do orçamento.
 */
async function etapaOrcamentoValida(
  supabase: Awaited<ReturnType<typeof createClient>>,
  obraId: string,
  escolhida: string | undefined
): Promise<{ nome: string | null; error?: string }> {
  if (!escolhida) return { nome: null };

  const { data: versao } = await supabase
    .from("orcamento_versoes")
    .select("id, etapas")
    .eq("obra_id", obraId)
    .eq("status", "ativa")
    .maybeSingle();

  if (!versao) return { nome: null, error: "Essa obra não tem orçamento ativo." };

  if (versao.etapas.includes(escolhida)) return { nome: escolhida };

  const { data: emItem } = await supabase
    .from("orcamento_itens")
    .select("etapa")
    .eq("orcamento_versao_id", versao.id)
    .eq("etapa", escolhida)
    .limit(1)
    .maybeSingle();

  if (emItem) return { nome: escolhida };
  return { nome: null, error: "Essa etapa não existe no orçamento ativo." };
}

/**
 * Vincula (ou desvincula, com etapa vazia) uma ordem de compra já criada a uma
 * etapa do orçamento.
 *
 * Existe porque o vínculo é o que alimenta o comparativo orçado × comprado, e
 * as ordens criadas antes deste campo precisam poder ser classificadas sem
 * recriar nada.
 */
export async function definirEtapaOrcamento(compraId: string, etapaNome: string) {
  await requireRole("engenheiro");
  const supabase = await createClient();

  const { data: compra } = await supabase
    .from("compras")
    .select("obra_id")
    .eq("id", compraId)
    .maybeSingle();

  if (!compra) throw new Error("Ordem de compra não encontrada.");

  const etapa = await etapaOrcamentoValida(supabase, compra.obra_id, etapaNome || undefined);
  if (etapa.error) throw new Error(etapa.error);

  const { error } = await supabase
    .from("compras")
    .update({ orcamento_etapa: etapa.nome, updated_at: new Date().toISOString() })
    .eq("id", compraId);

  if (error) throw new Error("Não foi possível vincular a etapa.");

  revalidatePath(`/obras/${compra.obra_id}/compras`);
  revalidatePath(`/obras/${compra.obra_id}/compras/${compraId}`);
  revalidatePath(`/obras/${compra.obra_id}/orcamento`);
}

export async function createCompra(
  obraId: string,
  _prevState: CompraFormState,
  formData: FormData
): Promise<CompraFormState> {
  const profile = await requireRole("engenheiro");

  const parsed = compraSchema.safeParse({
    fornecedor_id: formData.get("fornecedor_id"),
    descricao: formData.get("descricao"),
    forma_pagamento: formData.get("forma_pagamento"),
    data_cotacao: formData.get("data_cotacao"),
    categoria_id: formData.get("categoria_id") || undefined,
    tipo_item: formData.get("tipo_item") || undefined,
    data_entrega_prevista: formData.get("data_entrega_prevista") || undefined,
    nota_fiscal_numero: formData.get("nota_fiscal_numero") || undefined,
    nota_fiscal_emissao: formData.get("nota_fiscal_emissao") || undefined,
    orcamento_etapa: formData.get("orcamento_etapa") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const parcelasResult = parseParcelas(formData);
  if (parcelasResult.error !== undefined) return { error: parcelasResult.error };
  const { parcelas } = parcelasResult;

  if (!parcelas.length) {
    return { error: "Adicione ao menos uma parcela." };
  }

  const itensRaw = formData.get("itens");
  if (!itensRaw) return { error: "Adicione ao menos um item à ordem de compra." };

  let itens: z.infer<typeof itemCompraSchema>[];
  try {
    itens = z.array(itemCompraSchema).parse(JSON.parse(String(itensRaw)));
  } catch (err) {
    return { error: err instanceof z.ZodError ? err.issues[0]?.message ?? "Item inválido." : "Não foi possível interpretar os itens." };
  }
  if (!itens.length) return { error: "Adicione ao menos um item à ordem de compra." };

  const descontoNota = descontoNotaSchema.safeParse({
    desconto_tipo: formData.get("desconto_tipo") || undefined,
    desconto_valor: formData.get("desconto_valor") || undefined,
  });
  if (!descontoNota.success) {
    return { error: descontoNota.error.issues[0]?.message ?? "Desconto da nota inválido." };
  }

  // Confere se a soma das parcelas bate com o total calculado (itens com desconto individual,
  // depois o desconto da nota por cima) — mesma fórmula do trigger recalcular_valor_compra.
  const subtotalItens = itens.reduce((sum, item) => sum + calcularTotalItem(item), 0);
  const valorTotalEsperado = calcularTotalItem({
    quantidade: 1,
    preco_unitario: subtotalItens,
    desconto_tipo: descontoNota.data.desconto_tipo,
    desconto_valor: descontoNota.data.desconto_valor,
  });
  const valorParcelas = parcelas.reduce((sum, p) => sum + p.valor, 0);
  if (Math.abs(valorParcelas - valorTotalEsperado) > 0.01) {
    return {
      error: `A soma das parcelas (${valorParcelas.toFixed(2)}) precisa bater com o total da ordem de compra (${valorTotalEsperado.toFixed(2)}).`,
    };
  }

  const supabase = await createClient();

  const etapa = await etapaOrcamentoValida(supabase, obraId, parsed.data.orcamento_etapa);
  if (etapa.error) return { error: etapa.error };

  // Aprovação do cliente é opcional: se o engenheiro não marcar a exigência,
  // a compra já nasce aprovada por ele mesmo, sem travar esperando o cliente.
  const requerAprovacaoCliente = !!formData.get("requer_aprovacao_cliente");

  // Quando marcado, as parcelas dessa ordem só entram na lista de pagamentos
  // depois que o recebimento da mercadoria for confirmado.
  const pagamentoAposRecebimento = !!formData.get("pagamento_apos_recebimento");

  const { data: compra, error: compraError } = await supabase
    .from("compras")
    .insert({
      obra_id: obraId,
      fornecedor_id: parsed.data.fornecedor_id,
      descricao: parsed.data.descricao,
      forma_pagamento: parsed.data.forma_pagamento,
      data_cotacao: parsed.data.data_cotacao,
      valor_total: 0,
      desconto_tipo: descontoNota.data.desconto_tipo ?? null,
      desconto_valor: descontoNota.data.desconto_valor ?? 0,
      requer_aprovacao_cliente: requerAprovacaoCliente,
      pagamento_apos_recebimento: pagamentoAposRecebimento,
      orcamento_etapa: etapa.nome,
      categoria_id: parsed.data.categoria_id ?? null,
      tipo_item: parsed.data.tipo_item ?? null,
      data_entrega_prevista: parsed.data.data_entrega_prevista ?? null,
      nota_fiscal_numero: parsed.data.nota_fiscal_numero ?? null,
      nota_fiscal_emissao: parsed.data.nota_fiscal_emissao ?? null,
      status: requerAprovacaoCliente ? "cotada" : "aprovada",
      aprovado_por: requerAprovacaoCliente ? null : profile.id,
      aprovado_em: requerAprovacaoCliente ? null : new Date().toISOString(),
      criado_por: profile.id,
    })
    .select("id")
    .single();

  if (compraError || !compra) {
    return { error: "Não foi possível criar a ordem de compra." };
  }

  // O navegador já enviou o anexo ao Storage e manda só o caminho: arquivo
  // pela Server Action estoura o limite de payload em produção.
  const anexoPath = (formData.get("anexo_cotacao_path") as string) || null;
  if (anexoPath) {
    await supabase.from("compras").update({ anexo_cotacao_path: anexoPath }).eq("id", compra.id);
  }

  const { error: itensError } = await supabase.from("compra_itens").insert(
    itens.map((item, i) => ({
      compra_id: compra.id,
      orcamento_item_id: item.orcamento_item_id ?? null,
      descricao: item.descricao,
      unidade: item.unidade,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
      desconto_tipo: item.desconto_tipo ?? null,
      desconto_valor: item.desconto_valor ?? 0,
      ordem: i + 1,
    }))
  );

  if (itensError) {
    return { error: "Ordem de compra criada, mas houve erro ao salvar os itens." };
  }

  const { error: parcelasError } = await supabase.from("compra_parcelas").insert(
    parcelas.map((p, i) => ({
      compra_id: compra.id,
      numero_parcela: i + 1,
      valor: p.valor,
      data_vencimento: p.data_vencimento,
    }))
  );

  if (parcelasError) {
    return { error: "Itens salvos, mas houve erro ao salvar as parcelas." };
  }

  revalidatePath(`/obras/${obraId}/compras`);
  redirect(`/obras/${obraId}/compras/${compra.id}`);
}

const buscaItemSchema = z.object({ termo: z.string().min(2) });

/** Busca itens do planejamento ATIVO da obra — usada ao montar uma ordem de compra. */
export async function buscarItensPlanejamento(obraId: string, termo: string) {
  await requireRole("engenheiro");
  const parsed = buscaItemSchema.safeParse({ termo });
  if (!parsed.success) return [];

  const supabase = await createClient();
  const { data: versaoAtiva } = await supabase
    .from("orcamento_versoes")
    .select("id")
    .eq("obra_id", obraId)
    .eq("status", "ativa")
    .maybeSingle();

  if (!versaoAtiva) return [];

  // Remove caracteres com significado especial na mini-linguagem de filtro do PostgREST.
  const termoSeguro = parsed.data.termo.replace(/[,()]/g, " ").trim();

  const { data } = await supabase
    .from("orcamento_itens")
    .select("id, codigo_sinapi, descricao, unidade, preco_unitario")
    .eq("orcamento_versao_id", versaoAtiva.id)
    .or(`codigo_sinapi.ilike.%${termoSeguro}%,descricao.ilike.%${termoSeguro}%`)
    .limit(20);

  return data ?? [];
}

async function resolveObraIdForCompra(compraId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("compras").select("obra_id").eq("id", compraId).single();
  return data?.obra_id;
}

export async function aprovarCompraAction(compraId: string) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { error } = await supabase.rpc("aprovar_compra", { p_compra_id: compraId });

  const obraId = await resolveObraIdForCompra(compraId);
  if (obraId) {
    const base = profile.role === "engenheiro" ? `/obras/${obraId}` : `/portal/obras/${obraId}`;
    revalidatePath(`${base}/compras`);
    revalidatePath(`${base}/compras/${compraId}`);
  }

  if (error) throw new Error("Não foi possível aprovar a compra.");
}

export async function recusarCompraAction(compraId: string, formData: FormData) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const motivo = String(formData.get("motivo") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("recusar_compra", {
    p_compra_id: compraId,
    p_motivo: motivo,
  });

  const obraId = await resolveObraIdForCompra(compraId);
  if (obraId) {
    const base = profile.role === "engenheiro" ? `/obras/${obraId}` : `/portal/obras/${obraId}`;
    revalidatePath(`${base}/compras`);
    revalidatePath(`${base}/compras/${compraId}`);
  }

  if (error) throw new Error("Não foi possível recusar a compra.");
}

/**
 * Confirma (ou desfaz) o recebimento da mercadoria de uma ORDEM.
 *
 * Era por parcela, e isso significava liberar o pagamento aos pedaços: numa
 * compra de cimento em três vezes, confirmar o recebimento soltava só a
 * primeira parcela e as outras duas seguiam travadas sem motivo visível. A
 * mercadoria chega uma vez; quando chega, a ordem inteira passa a poder ser
 * paga.
 *
 * Quando a compra é "pagamento após recebimento", é isto que libera as
 * parcelas — antes disso nenhuma aparece como pendente nem vence.
 */
export async function confirmarRecebimentoOrdem(compraId: string, recebido: boolean) {
  const profile = await requireRole("engenheiro");
  const supabase = await createClient();

  await supabase
    .from("compras")
    .update({
      data_entrega_real: recebido ? hojeNoFuso() : null,
      recebimento_confirmado_por: recebido ? profile.id : null,
      recebimento_confirmado_em: recebido ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", compraId);

  const obraId = await resolveObraIdForCompra(compraId);
  if (obraId) {
    revalidatePath(`/obras/${obraId}/compras/${compraId}`);
    revalidatePath(`/obras/${obraId}/compras`);
    revalidatePath(`/portal/obras/${obraId}`);
  }
  revalidatePath("/dashboard");
}

/**
 * Marca (ou desmarca) que o pagamento da parcela foi lançado.
 *
 * É o passo entre "pode pagar" e "pago": nas ordens com pagamento condicionado
 * ao recebimento, o lançamento é um ato manual depois da mercadoria chegar, e
 * sem registrá-lo a parcela fica igual a uma que ninguém tocou. A partir daqui
 * ela deixa de aparecer como vencida — o atraso não é mais pendência de quem
 * olha a tela.
 *
 * Só aceita parcela liberada: dizer que o pagamento saiu antes do material
 * chegar contradiz exatamente a regra que a ordem pediu.
 */
export async function marcarPagamentoEnviado(
  compraId: string,
  parcelaId: string,
  enviado: boolean
) {
  const profile = await requireRole("engenheiro");
  const supabase = await createClient();

  const { data: parcela } = await supabase
    .from("vw_compra_parcelas")
    .select("id, status, liberada_para_pagamento")
    // Sem o compra_id, um id de parcela de outra compra seria aceito.
    .eq("compra_id", compraId)
    .eq("id", parcelaId)
    .maybeSingle();

  if (!parcela) throw new Error("Parcela não encontrada nessa ordem de compra.");
  if (parcela.status === "paga") {
    throw new Error("Essa parcela já está paga.");
  }
  if (enviado && !parcela.liberada_para_pagamento) {
    throw new Error("A mercadoria dessa parcela ainda não foi recebida.");
  }

  const { error } = await supabase
    .from("compra_parcelas")
    .update({
      pagamento_enviado_em: enviado ? new Date().toISOString().slice(0, 10) : null,
      pagamento_enviado_por: enviado ? profile.id : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parcelaId)
    .eq("compra_id", compraId);

  if (error) throw new Error("Não foi possível registrar o envio do pagamento.");

  const obraId = await resolveObraIdForCompra(compraId);
  if (obraId) {
    revalidatePath(`/obras/${obraId}/compras`);
    revalidatePath(`/obras/${obraId}/compras/${compraId}`);
    revalidatePath(`/obras/${obraId}`);
    revalidatePath(`/portal/obras/${obraId}`);
    revalidatePath(`/portal/obras/${obraId}/compras`);
    revalidatePath(`/portal/obras/${obraId}/compras/${compraId}`);
  }
  revalidatePath("/dashboard");
}

export async function pagarParcelaAction(
  compraId: string,
  parcelaId: string,
  comprovantePath: string
) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  if (!comprovantePath) throw new Error("Anexe o comprovante de pagamento.");

  const supabase = await createClient();
  const obraId = await resolveObraIdForCompra(compraId);

  const { error } = await supabase.rpc("pagar_parcela", {
    p_parcela_id: parcelaId,
    p_comprovante_path: comprovantePath,
  });

  if (obraId) {
    const base = profile.role === "engenheiro" ? `/obras/${obraId}` : `/portal/obras/${obraId}`;
    revalidatePath(`${base}/compras`);
    revalidatePath(`${base}/compras/${compraId}`);
  }

  if (error) throw new Error("Não foi possível marcar a parcela como paga.");
}

/**
 * "Pagar agora" (compra de parcela única): aprova e paga numa transação só.
 *
 * Antes eram duas chamadas em sequência. Falhando a segunda, a compra ficava
 * aprovada e o cliente não conseguia mais recusá-la — recusar_compra exige
 * status 'cotada'. O RPC faz as duas mudanças juntas ou nenhuma.
 */
export async function pagarCompraAgoraAction(
  compraId: string,
  parcelaId: string,
  comprovantePath: string
) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  if (!comprovantePath) throw new Error("Anexe o comprovante de pagamento.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("aprovar_e_pagar_parcela", {
    p_compra_id: compraId,
    p_parcela_id: parcelaId,
    p_comprovante_path: comprovantePath,
  });

  const obraId = await resolveObraIdForCompra(compraId);
  if (obraId) {
    const base = profile.role === "engenheiro" ? `/obras/${obraId}` : `/portal/obras/${obraId}`;
    revalidatePath(`${base}/compras`);
    revalidatePath(`${base}/compras/${compraId}`);
  }

  if (error) throw new Error("Não foi possível aprovar e pagar a ordem de compra.");
}
