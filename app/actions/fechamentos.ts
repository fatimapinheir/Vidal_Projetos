"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

const abrirFechamentoSchema = z.object({
  trabalhador_id: z.uuid(),
  periodo_inicio: z.string().min(1),
  periodo_fim: z.string().min(1),
});

export type FechamentoFormState = { error: string | null; success?: boolean };

export async function abrirFechamento(
  obraId: string,
  _prevState: FechamentoFormState,
  formData: FormData
): Promise<FechamentoFormState> {
  const profile = await requireRole("engenheiro");

  const parsed = abrirFechamentoSchema.safeParse({
    trabalhador_id: formData.get("trabalhador_id"),
    periodo_inicio: formData.get("periodo_inicio"),
    periodo_fim: formData.get("periodo_fim"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { trabalhador_id, periodo_inicio, periodo_fim } = parsed.data;
  const supabase = await createClient();

  const { data: alocacao } = await supabase
    .from("obra_trabalhadores")
    .select("valor_diaria")
    .eq("obra_id", obraId)
    .eq("trabalhador_id", trabalhador_id)
    .single();

  if (!alocacao) {
    return { error: "Trabalhador não está alocado nessa obra." };
  }

  // Mesma regra do fechamento por equipe: período que encosta em outro já
  // fechado pagaria os dias em comum duas vezes.
  const { data: sobreposto } = await supabase
    .from("fechamentos_periodo")
    .select("id")
    .eq("obra_id", obraId)
    .eq("trabalhador_id", trabalhador_id)
    .lte("periodo_inicio", periodo_fim)
    .gte("periodo_fim", periodo_inicio)
    .limit(1)
    .maybeSingle();

  if (sobreposto) {
    return { error: "Esse trabalhador já tem um fechamento que cobre parte desse período." };
  }

  const { data: diasTrabalhados } = await supabase.rpc("calcular_dias_trabalhados", {
    p_obra_id: obraId,
    p_trabalhador_id: trabalhador_id,
    p_inicio: periodo_inicio,
    p_fim: periodo_fim,
  });

  const { error } = await supabase.from("fechamentos_periodo").insert({
    obra_id: obraId,
    trabalhador_id,
    periodo_inicio,
    periodo_fim,
    dias_trabalhados: diasTrabalhados ?? 0,
    valor_diaria: alocacao.valor_diaria,
    criado_por: profile.id,
  });

  if (error) {
    return { error: "Não foi possível abrir o fechamento (período já existe para esse trabalhador?)." };
  }

  revalidatePath(`/obras/${obraId}/fechamentos`);
  return { error: null, success: true };
}

/**
 * O comprovante chega como caminho: o navegador já o enviou ao Storage. Antes
 * o arquivo trafegava por aqui (estoura o limite de payload em produção) e um
 * erro de upload era descartado — o fechamento virava "pago" sem comprovante e
 * ninguém ficava sabendo.
 */
export async function marcarFechamentoPago(
  obraId: string,
  fechamentoId: string,
  comprovantePath: string | null
): Promise<FechamentoFormState> {
  await requireRole("engenheiro");
  const supabase = await createClient();

  const { error } = await supabase
    .from("fechamentos_periodo")
    .update({
      status: "pago",
      data_pagamento: new Date().toISOString().slice(0, 10),
      ...(comprovantePath ? { comprovante_path: comprovantePath } : {}),
    })
    .eq("id", fechamentoId);

  if (error) return { error: "Não foi possível marcar o fechamento como pago." };

  revalidatePath(`/obras/${obraId}/fechamentos`);
  return { error: null, success: true };
}

const periodoSchema = z.object({
  periodo_inicio: z.string().min(1, "Informe o início do período."),
  periodo_fim: z.string().min(1, "Informe o fim do período."),
});

export type FechamentoEquipeFormState = { error: string | null; success?: boolean };

/**
 * Fecha uma equipe inteira de uma vez (contrato diária): insere um
 * fechamentos_periodo por membro, com a mesma fórmula de sempre (dias x diária
 * de cada um), todos marcados com o mesmo equipe_id para poderem ser agrupados
 * e pagos juntos. Membros que já têm fechamento nesse período exato são pulados.
 */
export async function abrirFechamentoEquipeDiaria(
  obraId: string,
  equipeId: string,
  _prevState: FechamentoEquipeFormState,
  formData: FormData
): Promise<FechamentoEquipeFormState> {
  const profile = await requireRole("engenheiro");

  const parsed = periodoSchema.safeParse({
    periodo_inicio: formData.get("periodo_inicio"),
    periodo_fim: formData.get("periodo_fim"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Informe o período." };
  }
  const { periodo_inicio, periodo_fim } = parsed.data;

  const supabase = await createClient();

  // As condições vivem no vínculo obra↔equipe: a mesma equipe pode ser diária
  // numa obra e empreitada em outra.
  const { data: vinculo } = await supabase
    .from("obra_equipes")
    .select("tipo_contrato")
    .eq("equipe_id", equipeId)
    .eq("obra_id", obraId)
    .eq("ativo", true)
    .maybeSingle();

  if (!vinculo || vinculo.tipo_contrato !== "diaria") {
    return { error: "Equipe não vinculada a essa obra ou não é do tipo diária." };
  }

  const { data: membros } = await supabase
    .from("equipe_trabalhadores")
    .select("trabalhador_id")
    .eq("equipe_id", equipeId);

  if (!membros?.length) return { error: "Essa equipe não tem membros." };
  const membroIds = membros.map((m) => m.trabalhador_id);

  const { data: alocacoes } = await supabase
    .from("obra_trabalhadores")
    .select("trabalhador_id, valor_diaria")
    .eq("obra_id", obraId)
    .in("trabalhador_id", membroIds);

  const valorDiariaPorMembro = new Map(alocacoes?.map((a) => [a.trabalhador_id, a.valor_diaria]) ?? []);

  // Sobreposição, não igualdade: fechar 01–15 e depois 01–30 pagaria os dias
  // 01–15 duas vezes. Dois períodos se sobrepõem quando cada um começa antes
  // (ou junto) do fim do outro.
  const { data: existentes } = await supabase
    .from("fechamentos_periodo")
    .select("trabalhador_id")
    .eq("obra_id", obraId)
    .lte("periodo_inicio", periodo_fim)
    .gte("periodo_fim", periodo_inicio)
    .in("trabalhador_id", membroIds);

  const jaFechados = new Set(existentes?.map((e) => e.trabalhador_id) ?? []);
  const pendentes = membroIds.filter((id) => !jaFechados.has(id));

  if (!pendentes.length) {
    return {
      error: "Todos os membros dessa equipe já têm fechamento cobrindo parte desse período.",
    };
  }

  const linhas = (
    await Promise.all(
      pendentes.map(async (trabalhadorId) => {
        const valorDiaria = valorDiariaPorMembro.get(trabalhadorId);
        if (valorDiaria === undefined) return null;
        const { data: dias } = await supabase.rpc("calcular_dias_trabalhados", {
          p_obra_id: obraId,
          p_trabalhador_id: trabalhadorId,
          p_inicio: periodo_inicio,
          p_fim: periodo_fim,
        });
        return {
          obra_id: obraId,
          trabalhador_id: trabalhadorId,
          equipe_id: equipeId,
          periodo_inicio,
          periodo_fim,
          dias_trabalhados: dias ?? 0,
          valor_diaria: valorDiaria,
          criado_por: profile.id,
        };
      })
    )
  ).filter((linha): linha is NonNullable<typeof linha> => linha !== null);

  if (!linhas.length) {
    return { error: "Nenhum membro dessa equipe está alocado nessa obra." };
  }

  const { error } = await supabase.from("fechamentos_periodo").insert(linhas);
  if (error) return { error: "Não foi possível abrir o fechamento da equipe." };

  revalidatePath(`/obras/${obraId}/fechamentos`);
  return { error: null, success: true };
}

/** Marca todos os fechamentos de uma equipe (mesmo período) como pagos de uma vez, com um comprovante só. */
export async function marcarFechamentoEquipePago(
  obraId: string,
  equipeId: string,
  periodoInicio: string,
  periodoFim: string,
  comprovantePath: string | null
): Promise<FechamentoFormState> {
  await requireRole("engenheiro");
  const supabase = await createClient();

  const { error } = await supabase
    .from("fechamentos_periodo")
    .update({
      status: "pago",
      data_pagamento: new Date().toISOString().slice(0, 10),
      ...(comprovantePath ? { comprovante_path: comprovantePath } : {}),
    })
    .eq("obra_id", obraId)
    .eq("equipe_id", equipeId)
    .eq("periodo_inicio", periodoInicio)
    .eq("periodo_fim", periodoFim);

  if (error) return { error: "Não foi possível marcar o fechamento da equipe como pago." };

  revalidatePath(`/obras/${obraId}/fechamentos`);
  return { error: null, success: true };
}

const entregaSchema = z.object({
  periodo_inicio: z.string().min(1, "Informe o início do período."),
  periodo_fim: z.string().min(1, "Informe o fim do período."),
  quantidade_entregue: z.coerce.number().positive("Informe a quantidade entregue."),
  observacoes: z.string().optional(),
});

export type FechamentoEntregaFormState = { error: string | null; success?: boolean };

/** Fecha pagamento por entrega (empreitada): quantidade entregue no período x valor por unidade da equipe. */
export async function abrirFechamentoEntrega(
  obraId: string,
  equipeId: string,
  _prevState: FechamentoEntregaFormState,
  formData: FormData
): Promise<FechamentoEntregaFormState> {
  const profile = await requireRole("engenheiro");

  const parsed = entregaSchema.safeParse({
    periodo_inicio: formData.get("periodo_inicio"),
    periodo_fim: formData.get("periodo_fim"),
    quantidade_entregue: formData.get("quantidade_entregue"),
    observacoes: formData.get("observacoes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();

  const { data: vinculo } = await supabase
    .from("obra_equipes")
    .select("tipo_contrato, unidade_medida, valor_unidade")
    .eq("equipe_id", equipeId)
    .eq("obra_id", obraId)
    .eq("ativo", true)
    .maybeSingle();

  if (
    !vinculo ||
    vinculo.tipo_contrato !== "empreitada" ||
    !vinculo.unidade_medida ||
    !vinculo.valor_unidade
  ) {
    return { error: "Equipe não vinculada a essa obra como empreitada." };
  }

  const { error } = await supabase.from("fechamentos_entrega").insert({
    obra_id: obraId,
    equipe_id: equipeId,
    periodo_inicio: parsed.data.periodo_inicio,
    periodo_fim: parsed.data.periodo_fim,
    quantidade_entregue: parsed.data.quantidade_entregue,
    unidade_medida: vinculo.unidade_medida,
    valor_unidade: vinculo.valor_unidade,
    observacoes: parsed.data.observacoes || null,
    criado_por: profile.id,
  });

  if (error) return { error: "Não foi possível abrir o fechamento por entrega." };

  revalidatePath(`/obras/${obraId}/fechamentos`);
  return { error: null, success: true };
}

export async function marcarFechamentoEntregaPago(
  obraId: string,
  fechamentoEntregaId: string,
  comprovantePath: string | null
): Promise<FechamentoFormState> {
  await requireRole("engenheiro");
  const supabase = await createClient();

  const { error } = await supabase
    .from("fechamentos_entrega")
    .update({
      status: "pago",
      data_pagamento: new Date().toISOString().slice(0, 10),
      ...(comprovantePath ? { comprovante_path: comprovantePath } : {}),
    })
    .eq("id", fechamentoEntregaId);

  if (error) return { error: "Não foi possível marcar a entrega como paga." };

  revalidatePath(`/obras/${obraId}/fechamentos`);
  return { error: null, success: true };
}
