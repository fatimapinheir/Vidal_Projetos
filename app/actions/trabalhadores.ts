"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

const trabalhadorSchema = z
  .object({
    nome: z.string().min(1, "Informe o nome do colaborador."),
    cpf: z.string().optional(),
    funcao: z.string().optional(),
    // Em que condição ele trabalha.
    regime_pagamento: z.enum(["diaria", "pacote_servico"]),
    valor_diaria_padrao: z.coerce.number().positive().optional(),
    // Por onde o dinheiro sai, e o dado necessário para pagar.
    forma_pagamento: z
      .preprocess(
        (v) => (v === "" || v == null ? undefined : v),
        z
          .enum([
            "dinheiro",
            "pix",
            "boleto",
            "cartao_credito",
            "cartao_debito",
            "transferencia",
            "cheque",
            "outro",
          ])
          .optional()
      ),
    dados_pagamento: z.string().optional(),
    telefone: z.string().optional(),
  })
  .refine((d) => d.forma_pagamento !== "pix" || !!d.dados_pagamento, {
    message: "Informe a chave pix.",
    path: ["dados_pagamento"],
  });

export type TrabalhadorFormState = { error: string | null; success?: boolean };

export async function createTrabalhador(
  _prevState: TrabalhadorFormState,
  formData: FormData
): Promise<TrabalhadorFormState> {
  await requireRole("engenheiro");

  const parsed = trabalhadorSchema.safeParse({
    nome: formData.get("nome"),
    cpf: formData.get("cpf") || undefined,
    funcao: formData.get("funcao") || undefined,
    regime_pagamento: formData.get("regime_pagamento"),
    valor_diaria_padrao: formData.get("valor_diaria_padrao") || undefined,
    forma_pagamento: formData.get("forma_pagamento"),
    dados_pagamento: formData.get("dados_pagamento") || undefined,
    telefone: formData.get("telefone") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("trabalhadores").insert({
    ...parsed.data,
    // Diária padrão só faz sentido em regime de diária — guardá-la num
    // colaborador por pacote induziria a erro no fechamento.
    valor_diaria_padrao:
      parsed.data.regime_pagamento === "diaria" ? (parsed.data.valor_diaria_padrao ?? null) : null,
    forma_pagamento: parsed.data.forma_pagamento ?? null,
    dados_pagamento: parsed.data.dados_pagamento ?? null,
  });

  if (error) return { error: "Não foi possível cadastrar o colaborador." };

  revalidatePath("/trabalhadores");
  return { error: null, success: true };
}

const alocacaoSchema = z.object({
  trabalhador_id: z.uuid(),
  valor_diaria: z.coerce.number().positive("Informe um valor de diária válido."),
});

export type AlocacaoFormState = { error: string | null; success?: boolean };

export async function alocarTrabalhadorNaObra(
  obraId: string,
  _prevState: AlocacaoFormState,
  formData: FormData
): Promise<AlocacaoFormState> {
  await requireRole("engenheiro");

  const parsed = alocacaoSchema.safeParse({
    trabalhador_id: formData.get("trabalhador_id"),
    valor_diaria: formData.get("valor_diaria"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("obra_trabalhadores").insert({
    obra_id: obraId,
    trabalhador_id: parsed.data.trabalhador_id,
    valor_diaria: parsed.data.valor_diaria,
  });

  if (error) {
    return { error: "Não foi possível alocar o trabalhador (já está nessa obra?)." };
  }

  revalidatePath(`/obras/${obraId}/equipe`);
  return { error: null, success: true };
}

/**
 * Apaga um colaborador do cadastro.
 *
 * Só apaga de verdade quem não deixou rastro. Presença lançada e fechamento de
 * folha são HISTÓRICO — e o banco já recusa a exclusão por eles (as chaves
 * estrangeiras são `no action`). Recusar com a mensagem do Postgres diria
 * "violates foreign key constraint"; aqui a tela diz o que de fato aconteceu e
 * o que fazer no lugar.
 *
 * Inativar continua sendo o caminho certo para quem trabalhou e saiu: o nome
 * dele precisa continuar existindo nos dias em que esteve na obra e nos
 * fechamentos que já foram pagos.
 */
export async function removerTrabalhador(
  trabalhadorId: string
): Promise<{ error: string | null }> {
  await requireRole("engenheiro");
  const supabase = await createClient();

  const [{ count: presencas }, { count: fechamentos }, { count: equipesQueLidera }] =
    await Promise.all([
      supabase
        .from("presencas")
        .select("trabalhador_id", { count: "exact", head: true })
        .eq("trabalhador_id", trabalhadorId),
      supabase
        .from("fechamentos_periodo")
        .select("trabalhador_id", { count: "exact", head: true })
        .eq("trabalhador_id", trabalhadorId),
      supabase
        .from("equipes")
        .select("id", { count: "exact", head: true })
        .eq("responsavel_id", trabalhadorId),
    ]);

  if (presencas || fechamentos) {
    return {
      error:
        "Esse colaborador já tem presença ou fechamento lançado — apagá-lo apagaria o histórico da obra. Marque como inativo: ele some das listas de alocação e o que já passou continua de pé.",
    };
  }

  if (equipesQueLidera) {
    return {
      error:
        "Esse colaborador é responsável por uma equipe. Troque o responsável dela antes de apagá-lo.",
    };
  }

  // Alocação em obra e participação em equipe caem por cascade: são vínculos
  // do presente, não registro do que aconteceu.
  const { error } = await supabase.from("trabalhadores").delete().eq("id", trabalhadorId);
  if (error) return { error: "Não foi possível apagar o colaborador." };

  revalidatePath("/trabalhadores");
  return { error: null };
}
