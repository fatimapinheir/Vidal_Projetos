"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole, requireAuth } from "@/lib/auth/require-role";
import { subtotalDosItens, aplicarDescontoDaNota } from "@/lib/compras/total-item";
import { etapaOrcamentoValida } from "@/lib/compras/etapa-orcamento";
import { lerAnexosDoForm } from "@/lib/compras/anexos";

export type CotacaoFormState = { error: string | null };

const cotacaoSchema = z.object({
  descricao: z.string().trim().min(1, "Descreva o que está sendo cotado."),
  orcamento_etapa: z.string().optional(),
  prazo_decisao: z.string().optional(),
  observacoes: z.string().trim().optional(),
});

const propostaSchema = z.object({
  fornecedor_id: z.uuid("Selecione um fornecedor."),
  observacoes: z.string().trim().optional(),
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
  data_proposta: z.string().min(1, "Informe a data da proposta."),
  data_entrega_prevista: z.string().optional(),
  categoria_id: z.uuid().optional(),
});

/**
 * Item da proposta: o MESMO contrato de `itemCompraSchema`.
 *
 * Duplicado de propósito em vez de importado da ação de compras: aquele arquivo
 * não exporta o schema, e exportá-lo tornaria pública uma peça que só existe
 * para validar o form de lá. O que não pode divergir é a FORMA — a conversão em
 * `escolher_proposta` é um insert-select coluna a coluna.
 */
const itemPropostaSchema = z
  .object({
    orcamento_item_id: z.uuid().optional(),
    insumo_id: z.uuid().optional(),
    descricao: z.string().min(1, "Descreva o item."),
    unidade: z.string().min(1, "Informe a unidade."),
    categoria_custo: z.enum(["material", "servico", "mao_de_obra"]).optional(),
    quantidade: z.coerce.number().positive("Quantidade deve ser maior que zero."),
    preco_unitario: z.coerce.number().min(0, "Preço unitário inválido."),
    desconto_tipo: z.enum(["valor", "percentual"]).optional(),
    desconto_valor: z.coerce.number().min(0).optional(),
  })
  .refine((item) => item.desconto_tipo !== "percentual" || (item.desconto_valor ?? 0) <= 100, {
    message: "Desconto percentual não pode passar de 100%.",
    path: ["desconto_valor"],
  });

const descontoSchema = z
  .object({
    desconto_tipo: z.enum(["valor", "percentual"]).optional(),
    desconto_valor: z.coerce.number().min(0).optional(),
  })
  .refine((d) => d.desconto_tipo !== "percentual" || (d.desconto_valor ?? 0) <= 100, {
    message: "Desconto percentual não pode passar de 100%.",
    path: ["desconto_valor"],
  });

const parcelaSchema = z.object({
  valor: z.coerce.number().positive("Valor da parcela deve ser positivo."),
  data_vencimento: z.string().min(1, "Informe o vencimento da parcela."),
});

type ParcelaInput = { valor: number; data_vencimento: string };

function parseParcelas(
  formData: FormData
): { error: string; parcelas?: undefined } | { error?: undefined; parcelas: ParcelaInput[] } {
  const parcelas: ParcelaInput[] = [];
  let index = 0;
  while (formData.has(`parcela_valor_${index}`)) {
    const parsed = parcelaSchema.safeParse({
      valor: formData.get(`parcela_valor_${index}`),
      data_vencimento: formData.get(`parcela_vencimento_${index}`),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Parcela inválida." };
    }
    parcelas.push(parsed.data);
    index += 1;
  }
  return { parcelas };
}

/**
 * Lê itens, desconto e parcelas da proposta e confere se fecham entre si.
 *
 * A mesma conferência da ordem de compra, pela mesma razão: o total da proposta
 * é derivado dos itens pelo gatilho, então um plano de parcelas que não soma o
 * total geraria uma ORDEM inconsistente no dia em que a proposta fosse
 * escolhida — longe daqui, e sem ninguém para corrigir.
 */
type ValoresDaProposta = {
  itens: z.infer<typeof itemPropostaSchema>[];
  desconto: z.infer<typeof descontoSchema>;
  parcelas: ParcelaInput[];
  total: number;
};

type LeituraDaProposta =
  | { error: string; valores?: undefined }
  | { error?: undefined; valores: ValoresDaProposta };

function lerValoresDaProposta(formData: FormData): LeituraDaProposta {
  const itensRaw = formData.get("itens");
  if (!itensRaw) return { error: "Adicione ao menos um item à proposta." };

  let itens: z.infer<typeof itemPropostaSchema>[];
  try {
    itens = z.array(itemPropostaSchema).parse(JSON.parse(String(itensRaw)));
  } catch (err) {
    return {
      error:
        err instanceof z.ZodError
          ? err.issues[0]?.message ?? "Item inválido."
          : "Não foi possível interpretar os itens.",
    };
  }
  if (!itens.length) return { error: "Adicione ao menos um item à proposta." };

  const desconto = descontoSchema.safeParse({
    desconto_tipo: formData.get("desconto_tipo") || undefined,
    desconto_valor: formData.get("desconto_valor") || undefined,
  });
  if (!desconto.success) {
    return { error: desconto.error.issues[0]?.message ?? "Desconto inválido." };
  }

  const parcelasResult = parseParcelas(formData);
  if (parcelasResult.error !== undefined) return { error: parcelasResult.error };
  const { parcelas } = parcelasResult;
  if (!parcelas.length) return { error: "Adicione ao menos uma parcela." };

  const total = aplicarDescontoDaNota(
    subtotalDosItens(itens),
    desconto.data.desconto_tipo,
    desconto.data.desconto_valor
  );
  const somaParcelas = parcelas.reduce((s, p) => s + p.valor, 0);
  if (Math.abs(somaParcelas - total) > 0.01) {
    return {
      error: `A soma das parcelas (${somaParcelas.toFixed(2)}) precisa bater com o total da proposta (${total.toFixed(2)}).`,
    };
  }

  return { valores: { itens, desconto: desconto.data, parcelas, total } };
}

function revalidarCotacao(obraId: string, cotacaoId?: string) {
  revalidatePath(`/obras/${obraId}/cotacoes`);
  revalidatePath(`/portal/obras/${obraId}/cotacoes`);
  if (cotacaoId) {
    revalidatePath(`/obras/${obraId}/cotacoes/${cotacaoId}`);
    revalidatePath(`/portal/obras/${obraId}/cotacoes/${cotacaoId}`);
  }
  // O aviso de "cotação pendente" mora na visão geral dos dois lados.
  revalidatePath(`/obras/${obraId}`);
  revalidatePath(`/portal/obras/${obraId}`);
}

// ---------------------------------------------------------------------------
// A cotação
// ---------------------------------------------------------------------------

export async function criarCotacao(
  obraId: string,
  _prev: CotacaoFormState,
  formData: FormData
): Promise<CotacaoFormState> {
  const profile = await requireRole("engenheiro");

  const parsed = cotacaoSchema.safeParse({
    descricao: formData.get("descricao"),
    orcamento_etapa: formData.get("orcamento_etapa") || undefined,
    prazo_decisao: formData.get("prazo_decisao") || undefined,
    observacoes: formData.get("observacoes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const etapa = await etapaOrcamentoValida(supabase, obraId, parsed.data.orcamento_etapa);
  if (etapa.error) return { error: etapa.error };

  const { data: cotacao, error } = await supabase
    .from("cotacoes")
    .insert({
      obra_id: obraId,
      descricao: parsed.data.descricao,
      orcamento_etapa: etapa.nome,
      prazo_decisao: parsed.data.prazo_decisao ?? null,
      observacoes: parsed.data.observacoes ?? null,
      criado_por: profile.id,
    })
    .select("id")
    .single();

  if (error || !cotacao) return { error: "Não foi possível criar a cotação." };

  revalidarCotacao(obraId, cotacao.id);
  // Vai para a cotação, e não para a lista: ela nasce vazia, e a próxima coisa
  // a fazer é cadastrar a primeira proposta.
  redirect(`/obras/${obraId}/cotacoes/${cotacao.id}`);
}

export async function atualizarCotacao(
  obraId: string,
  cotacaoId: string,
  _prev: CotacaoFormState,
  formData: FormData
): Promise<CotacaoFormState> {
  await requireRole("engenheiro");

  const parsed = cotacaoSchema.safeParse({
    descricao: formData.get("descricao"),
    orcamento_etapa: formData.get("orcamento_etapa") || undefined,
    prazo_decisao: formData.get("prazo_decisao") || undefined,
    observacoes: formData.get("observacoes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();

  const { data: atual } = await supabase
    .from("cotacoes")
    .select("status")
    .eq("id", cotacaoId)
    .maybeSingle();

  if (!atual) return { error: "Cotação não encontrada." };
  if (atual.status === "decidida" || atual.status === "recusada") {
    return { error: "Esta cotação já foi decidida e não pode mais ser alterada." };
  }

  const etapa = await etapaOrcamentoValida(supabase, obraId, parsed.data.orcamento_etapa);
  if (etapa.error) return { error: etapa.error };

  const { error } = await supabase
    .from("cotacoes")
    .update({
      descricao: parsed.data.descricao,
      orcamento_etapa: etapa.nome,
      prazo_decisao: parsed.data.prazo_decisao ?? null,
      observacoes: parsed.data.observacoes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cotacaoId);

  if (error) return { error: "Não foi possível salvar a cotação." };

  revalidarCotacao(obraId, cotacaoId);
  redirect(`/obras/${obraId}/cotacoes/${cotacaoId}`);
}

/**
 * Manda a cotação para o cliente decidir — ou a chama de volta para rascunho.
 *
 * Enquanto é rascunho o cliente não vê nada (a policy barra `status =
 * 'rascunho'`): meia comparação, com duas das três propostas cadastradas, é
 * pior que nenhuma.
 */
export async function definirEnvioAoCliente(cotacaoId: string, enviar: boolean) {
  await requireRole("engenheiro");
  const supabase = await createClient();

  const { data: cotacao } = await supabase
    .from("cotacoes")
    .select("obra_id, status")
    .eq("id", cotacaoId)
    .maybeSingle();

  if (!cotacao) throw new Error("Cotação não encontrada.");
  if (cotacao.status === "decidida" || cotacao.status === "recusada") {
    throw new Error("Esta cotação já foi decidida.");
  }

  if (enviar) {
    const { count } = await supabase
      .from("cotacao_propostas")
      .select("id", { count: "exact", head: true })
      .eq("cotacao_id", cotacaoId);

    // Uma basta: foi a decisão do engenheiro. Há caso de fornecedor único, e
    // exigir duas obrigaria a inventar uma proposta de mentira.
    if (!count) throw new Error("Cadastre ao menos uma proposta antes de enviar ao cliente.");
  }

  const { error } = await supabase
    .from("cotacoes")
    .update({
      status: enviar ? "aguardando_cliente" : "rascunho",
      updated_at: new Date().toISOString(),
    })
    .eq("id", cotacaoId);

  if (error) throw new Error("Não foi possível mudar a situação da cotação.");

  revalidarCotacao(cotacao.obra_id, cotacaoId);
}

/**
 * Apaga a cotação inteira, com as propostas e os arquivos.
 *
 * A cotação DECIDIDA também pode ser apagada, e a ordem de compra gerada
 * sobrevive: `compras.cotacao_proposta_id` é `on delete set null`. O contrário
 * — arrastar a ordem junto — apagaria dinheiro já comprometido por causa de uma
 * faxina no histórico de cotação.
 */
export async function excluirCotacao(cotacaoId: string): Promise<{ error: string | null }> {
  await requireRole("engenheiro");
  const supabase = await createClient();

  const { data: cotacao } = await supabase
    .from("cotacoes")
    .select("obra_id")
    .eq("id", cotacaoId)
    .maybeSingle();

  if (!cotacao) return { error: "Cotação não encontrada." };

  // Antes do delete: depois dele as linhas que apontam para os arquivos já não
  // existem, e os objetos ficariam órfãos no bucket.
  const { data: propostas } = await supabase
    .from("cotacao_propostas")
    .select("id")
    .eq("cotacao_id", cotacaoId);

  const ids = (propostas ?? []).map((p) => p.id);
  const { data: anexos } = ids.length
    ? await supabase.from("cotacao_proposta_anexos").select("path").in("proposta_id", ids)
    : { data: [] };

  const { data: apagadas, error } = await supabase
    .from("cotacoes")
    .delete()
    .eq("id", cotacaoId)
    .select("id");

  if (error) return { error: "Não foi possível excluir esta cotação." };
  if (!apagadas?.length) return { error: "Só o engenheiro pode excluir uma cotação." };

  const paths = (anexos ?? []).map((a) => a.path);
  if (paths.length) {
    // Service key, e best-effort: a linha já se foi, e falha em remover arquivo
    // não deve virar erro numa exclusão concluída.
    await createAdminClient().storage.from("cotacoes").remove(paths);
  }

  revalidarCotacao(cotacao.obra_id, cotacaoId);
  return { error: null };
}

// ---------------------------------------------------------------------------
// As propostas
// ---------------------------------------------------------------------------

async function cotacaoEditavel(cotacaoId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cotacoes")
    .select("id, obra_id, status")
    .eq("id", cotacaoId)
    .maybeSingle();

  if (!data) return { error: "Cotação não encontrada." as string };
  if (data.status === "decidida" || data.status === "recusada") {
    return { error: "Esta cotação já foi decidida: as propostas não mudam mais." as string };
  }
  return { cotacao: data };
}

export async function criarProposta(
  obraId: string,
  cotacaoId: string,
  _prev: CotacaoFormState,
  formData: FormData
): Promise<CotacaoFormState> {
  const profile = await requireRole("engenheiro");

  const permitido = await cotacaoEditavel(cotacaoId);
  if (permitido.error) return { error: permitido.error };

  const parsed = propostaSchema.safeParse({
    fornecedor_id: formData.get("fornecedor_id"),
    observacoes: formData.get("observacoes") || undefined,
    forma_pagamento: formData.get("forma_pagamento"),
    data_proposta: formData.get("data_proposta"),
    data_entrega_prevista: formData.get("data_entrega_prevista") || undefined,
    categoria_id: formData.get("categoria_id") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const leitura = lerValoresDaProposta(formData);
  if (leitura.error !== undefined) return { error: leitura.error };
  const { valores } = leitura;

  const supabase = await createClient();

  const { data: proposta, error } = await supabase
    .from("cotacao_propostas")
    .insert({
      cotacao_id: cotacaoId,
      fornecedor_id: parsed.data.fornecedor_id,
      observacoes: parsed.data.observacoes ?? null,
      forma_pagamento: parsed.data.forma_pagamento,
      data_proposta: parsed.data.data_proposta,
      data_entrega_prevista: parsed.data.data_entrega_prevista ?? null,
      categoria_id: parsed.data.categoria_id ?? null,
      desconto_tipo: valores.desconto.desconto_tipo ?? null,
      desconto_valor: valores.desconto.desconto_valor ?? 0,
      valor_total: 0,
      criado_por: profile.id,
    })
    .select("id")
    .single();

  if (error || !proposta) return { error: "Não foi possível criar a proposta." };

  const erroFilhos = await gravarFilhosDaProposta(
    supabase,
    proposta.id,
    valores,
    lerAnexosDoForm(formData),
    profile.id
  );
  if (erroFilhos) return { error: erroFilhos };

  revalidarCotacao(obraId, cotacaoId);
  redirect(`/obras/${obraId}/cotacoes/${cotacaoId}`);
}

export async function atualizarProposta(
  obraId: string,
  cotacaoId: string,
  propostaId: string,
  _prev: CotacaoFormState,
  formData: FormData
): Promise<CotacaoFormState> {
  const profile = await requireRole("engenheiro");

  const permitido = await cotacaoEditavel(cotacaoId);
  if (permitido.error) return { error: permitido.error };

  const parsed = propostaSchema.safeParse({
    fornecedor_id: formData.get("fornecedor_id"),
    observacoes: formData.get("observacoes") || undefined,
    forma_pagamento: formData.get("forma_pagamento"),
    data_proposta: formData.get("data_proposta"),
    data_entrega_prevista: formData.get("data_entrega_prevista") || undefined,
    categoria_id: formData.get("categoria_id") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const leitura = lerValoresDaProposta(formData);
  if (leitura.error !== undefined) return { error: leitura.error };
  const { valores } = leitura;

  const supabase = await createClient();

  const { error } = await supabase
    .from("cotacao_propostas")
    .update({
      fornecedor_id: parsed.data.fornecedor_id,
      observacoes: parsed.data.observacoes ?? null,
      forma_pagamento: parsed.data.forma_pagamento,
      data_proposta: parsed.data.data_proposta,
      data_entrega_prevista: parsed.data.data_entrega_prevista ?? null,
      categoria_id: parsed.data.categoria_id ?? null,
      desconto_tipo: valores.desconto.desconto_tipo ?? null,
      desconto_valor: valores.desconto.desconto_valor ?? 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", propostaId);

  if (error) return { error: "Não foi possível salvar a proposta." };

  /*
   * Itens e parcelas são REESCRITOS, não costurados linha a linha.
   *
   * Nada aqui foi pago nem entregue — proposta não se paga —, então não existe
   * o problema que travaria a edição de uma ordem de compra. Apagar e inserir
   * de novo é o caminho em que a tela e o banco não podem discordar sobre o que
   * sobrou.
   */
  await supabase.from("cotacao_proposta_itens").delete().eq("proposta_id", propostaId);
  await supabase.from("cotacao_proposta_parcelas").delete().eq("proposta_id", propostaId);

  const erroFilhos = await gravarFilhosDaProposta(
    supabase,
    propostaId,
    valores,
    lerAnexosDoForm(formData),
    profile.id
  );
  if (erroFilhos) return { error: erroFilhos };

  revalidarCotacao(obraId, cotacaoId);
  redirect(`/obras/${obraId}/cotacoes/${cotacaoId}`);
}

async function gravarFilhosDaProposta(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propostaId: string,
  valores: ValoresDaProposta,
  anexos: { path: string; nome: string }[],
  criadoPor: string
): Promise<string | null> {
  const { error: erroItens } = await supabase.from("cotacao_proposta_itens").insert(
    valores.itens.map((item, i) => ({
      proposta_id: propostaId,
      orcamento_item_id: item.orcamento_item_id ?? null,
      insumo_id: item.insumo_id ?? null,
      descricao: item.descricao,
      unidade: item.unidade,
      categoria_custo: item.categoria_custo ?? null,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
      desconto_tipo: item.desconto_tipo ?? null,
      desconto_valor: item.desconto_valor ?? 0,
      ordem: i + 1,
    }))
  );
  if (erroItens) return "Proposta salva, mas houve erro ao gravar os itens.";

  const { error: erroParcelas } = await supabase.from("cotacao_proposta_parcelas").insert(
    valores.parcelas.map((p, i) => ({
      proposta_id: propostaId,
      numero_parcela: i + 1,
      valor: p.valor,
      data_vencimento: p.data_vencimento,
    }))
  );
  if (erroParcelas) return "Itens salvos, mas houve erro ao gravar as parcelas.";

  if (anexos.length) {
    const { error: erroAnexos } = await supabase.from("cotacao_proposta_anexos").insert(
      anexos.map((anexo) => ({
        proposta_id: propostaId,
        bucket: "cotacoes" as const,
        path: anexo.path,
        nome: anexo.nome,
        criado_por: criadoPor,
      }))
    );
    if (erroAnexos) return "Proposta salva, mas não foi possível anexar os arquivos.";
  }

  return null;
}

export async function excluirProposta(propostaId: string): Promise<{ error: string | null }> {
  await requireRole("engenheiro");
  const supabase = await createClient();

  const { data: proposta } = await supabase
    .from("cotacao_propostas")
    .select("cotacao_id, status, cotacoes(obra_id, status)")
    .eq("id", propostaId)
    .maybeSingle<{
      cotacao_id: string;
      status: string;
      cotacoes: { obra_id: string; status: string } | null;
    }>();

  if (!proposta?.cotacoes) return { error: "Proposta não encontrada." };
  if (proposta.cotacoes.status === "decidida" || proposta.cotacoes.status === "recusada") {
    return { error: "Esta cotação já foi decidida: as propostas não mudam mais." };
  }

  const { data: anexos } = await supabase
    .from("cotacao_proposta_anexos")
    .select("path")
    .eq("proposta_id", propostaId);

  const { data: apagadas, error } = await supabase
    .from("cotacao_propostas")
    .delete()
    .eq("id", propostaId)
    .select("id");

  if (error) return { error: "Não foi possível excluir esta proposta." };
  if (!apagadas?.length) return { error: "Só o engenheiro pode excluir uma proposta." };

  const paths = (anexos ?? []).map((a) => a.path);
  if (paths.length) await createAdminClient().storage.from("cotacoes").remove(paths);

  revalidarCotacao(proposta.cotacoes.obra_id, proposta.cotacao_id);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Decidir
// ---------------------------------------------------------------------------

/**
 * Escolhe uma proposta — e é aqui que a cotação deixa de ser cotação.
 *
 * As sete escritas (ordem, itens, parcelas, as duas marcações de proposta e a
 * da cotação) acontecem dentro de `escolher_proposta`, no banco, por uma razão
 * simples: pela ação seriam sete idas sem transação em volta, e uma falha no
 * meio deixaria a cotação decidida sem ordem de compra.
 */
export async function escolherPropostaAction(propostaId: string) {
  const perfil = await requireAuth();
  const supabase = await createClient();

  const { data: proposta } = await supabase
    .from("cotacao_propostas")
    .select("cotacao_id, cotacoes(obra_id)")
    .eq("id", propostaId)
    .maybeSingle<{ cotacao_id: string; cotacoes: { obra_id: string } | null }>();

  const { data: compraId, error } = await supabase.rpc("escolher_proposta", {
    p_proposta_id: propostaId,
  });

  if (proposta?.cotacoes) {
    const obraId = proposta.cotacoes.obra_id;
    revalidarCotacao(obraId, proposta.cotacao_id);
    // A ordem de compra nasceu agora, e aprovada: entra no comprometido da
    // obra e na lista dos dois lados.
    revalidatePath(`/obras/${obraId}/compras`);
    revalidatePath(`/portal/obras/${obraId}/compras`);
    revalidatePath(`/obras/${obraId}/orcamento`);
    revalidatePath(`/portal/obras/${obraId}/orcamento`);
  }

  // A mensagem do banco é útil ("já foi decidida", "não tem itens") e chega
  // escrita para humano — repassar é melhor que trocar por uma genérica.
  if (error) throw new Error(error.message || "Não foi possível escolher esta proposta.");

  if (proposta?.cotacoes && compraId) {
    const base = perfil.role === "engenheiro" ? "/obras" : "/portal/obras";
    redirect(`${base}/${proposta.cotacoes.obra_id}/compras/${compraId}`);
  }
}

export async function recusarCotacaoAction(cotacaoId: string, formData: FormData) {
  await requireAuth();
  const supabase = await createClient();

  const { data: cotacao } = await supabase
    .from("cotacoes")
    .select("obra_id")
    .eq("id", cotacaoId)
    .maybeSingle();

  const { error } = await supabase.rpc("recusar_cotacao", {
    p_cotacao_id: cotacaoId,
    p_motivo: String(formData.get("motivo") ?? ""),
  });

  if (cotacao) revalidarCotacao(cotacao.obra_id, cotacaoId);
  if (error) throw new Error(error.message || "Não foi possível recusar a cotação.");
}
