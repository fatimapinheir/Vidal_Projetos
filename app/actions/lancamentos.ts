"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/require-role";
import { parseNumeroBR } from "@/lib/parse-numero-br";
import { lerAnexosDoForm, salvarAnexosDaCompra } from "@/lib/compras/anexos";

const itemSchema = z.object({
  orcamento_item_id: z.uuid().optional(),
  descricao: z.string().min(1),
  unidade: z.string().min(1),
  quantidade: z.number().positive(),
  preco_unitario: z.number().nonnegative(),
  desconto_tipo: z.enum(["valor", "percentual"]).optional(),
  desconto_valor: z.number().nonnegative().optional(),
});

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
  valor: z.number().positive("O valor precisa ser maior que zero."),
  // O primeiro arquivo anexado. Continua obrigatório e continua indo para a
  // parcela — ver o insert da parcela, mais abaixo.
  comprovante_path: z.string().min(1, "Anexe o comprovante do pagamento."),
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
    valor: parseNumeroBR(String(formData.get("valor") ?? "")),
    comprovante_path: formData.get("comprovante_path"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();

  /*
   * Itens, opcionais.
   *
   * Quando existem, é o gatilho `trg_compra_itens_recalcula` que define
   * `compras.valor_total` a partir deles — por isso o valor digitado entra
   * como ponto de partida e é relido depois do insert. Sem itens (um IPTU,
   * uma taxa), o valor digitado é o que vale e nenhum gatilho dispara.
   */
  let itens: z.infer<typeof itemSchema>[] = [];
  const itensRaw = formData.get("itens");
  if (itensRaw) {
    try {
      itens = z.array(itemSchema).parse(JSON.parse(String(itensRaw)));
    } catch {
      return { error: "Não foi possível ler os itens do lançamento." };
    }
  }

  const { data: compra, error } = await supabase
    .from("compras")
    .insert({
      obra_id: obraId,
      fornecedor_id: parsed.data.fornecedor_id,
      descricao: parsed.data.descricao,
      valor_total: parsed.data.valor,
      forma_pagamento: parsed.data.forma_pagamento,
      categoria_id: parsed.data.categoria_id ?? null,
      tipo_item: parsed.data.tipo_item ?? null,
      nota_fiscal_numero: parsed.data.nota_fiscal_numero ?? null,
      nota_fiscal_emissao: parsed.data.nota_fiscal_emissao ?? null,
      data_entrega_prevista: parsed.data.data_entrega_prevista ?? null,
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

  let valorFinal = parsed.data.valor;

  if (itens.length) {
    const { error: erroItens } = await supabase.from("compra_itens").insert(
      itens.map((item, i) => ({
        compra_id: compra.id,
        orcamento_item_id: item.orcamento_item_id ?? null,
        descricao: item.descricao,
        unidade: item.unidade,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        desconto_tipo: item.desconto_tipo ?? null,
        desconto_valor: item.desconto_valor ?? null,
        ordem: i + 1,
      }))
    );
    if (erroItens) return { error: "Não foi possível salvar os itens do lançamento." };

    // Relê o total já recalculado pelo gatilho: é ele, e não o valor
    // digitado, que a parcela precisa espelhar — senão o pagamento diria um
    // número e a soma dos itens diria outro.
    const { data: atualizada } = await supabase
      .from("compras")
      .select("valor_total")
      .eq("id", compra.id)
      .single();
    if (atualizada) valorFinal = atualizada.valor_total;
  }

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
