"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { derivarConteudoDia } from "@/lib/diario/montar-dia";

export type DiarioFormState = { error: string | null; success?: boolean };

const climaValues = ["praticavel", "chuva", "impraticavel"] as const;

const climaOpcional = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.enum(climaValues).optional()
);

const textoOpcional = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().optional()
);

const diarioSchema = z.object({
  clima_manha: climaOpcional,
  clima_tarde: climaOpcional,
  clima_noite: climaOpcional,
  atividades: textoOpcional,
  ocorrencias: textoOpcional,
  visitas: textoOpcional,
});

/** Uma folha fechada é documento — só volta a aceitar escrita depois de reaberta. */
async function garantirAberto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  obraId: string,
  data: string
): Promise<{ id: string; fechado: boolean } | null> {
  const { data: diario } = await supabase
    .from("diario_obra")
    .select("id, fechado_em")
    .eq("obra_id", obraId)
    .eq("data", data)
    .maybeSingle();

  if (!diario) return null;
  return { id: diario.id, fechado: !!diario.fechado_em };
}

export async function salvarDiario(
  obraId: string,
  data: string,
  _prevState: DiarioFormState,
  formData: FormData
): Promise<DiarioFormState> {
  const profile = await requireRole("engenheiro");
  const parsed = diarioSchema.safeParse({
    clima_manha: formData.get("clima_manha"),
    clima_tarde: formData.get("clima_tarde"),
    clima_noite: formData.get("clima_noite"),
    atividades: formData.get("atividades"),
    ocorrencias: formData.get("ocorrencias"),
    visitas: formData.get("visitas"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const existente = await garantirAberto(supabase, obraId, data);
  if (existente?.fechado) {
    return { error: "Esse dia está fechado. Reabra antes de editar." };
  }

  const campos = {
    clima_manha: parsed.data.clima_manha ?? null,
    clima_tarde: parsed.data.clima_tarde ?? null,
    clima_noite: parsed.data.clima_noite ?? null,
    atividades: parsed.data.atividades ?? null,
    ocorrencias: parsed.data.ocorrencias ?? null,
    visitas: parsed.data.visitas ?? null,
  };

  const { error } = existente
    ? await supabase
        .from("diario_obra")
        .update({ ...campos, updated_at: new Date().toISOString() })
        .eq("id", existente.id)
    : await supabase
        .from("diario_obra")
        .insert({ obra_id: obraId, data, ...campos, registrado_por: profile.id });

  if (error) return { error: "Não foi possível salvar o diário." };

  revalidatePath(`/obras/${obraId}/diario`);
  revalidatePath(`/obras/${obraId}/diario/${data}`);
  return { error: null, success: true };
}

/**
 * Fecha o dia: congela efetivo, equipamentos, tarefas previstas e entregas no
 * estado atual. A partir daqui a folha vira documento e o cliente passa a
 * enxergá-la no portal.
 */
export async function fecharDia(obraId: string, data: string): Promise<DiarioFormState> {
  const profile = await requireRole("engenheiro");
  const supabase = await createClient();

  const existente = await garantirAberto(supabase, obraId, data);
  if (!existente) return { error: "Salve o diário antes de fechar o dia." };
  if (existente.fechado) return { error: null, success: true };

  const conteudo = await derivarConteudoDia(supabase, obraId, data);

  const { error } = await supabase
    .from("diario_obra")
    .update({
      efetivo_snapshot: conteudo.efetivo,
      equipamentos_snapshot: conteudo.equipamentos,
      tarefas_snapshot: conteudo.tarefas,
      // O id da parcela não vai pro congelado: ele serve pra confirmar
      // recebimento, e folha fechada não aceita mais essa ação.
      entregas_snapshot: conteudo.entregas.map((entrega) => ({
        descricao: entrega.descricao,
        fornecedor: entrega.fornecedor,
        parcela: entrega.parcela,
        recebidoEm: entrega.recebidoEm,
      })),
      fechado_em: new Date().toISOString(),
      fechado_por: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existente.id);

  if (error) return { error: "Não foi possível fechar o dia." };

  revalidatePath(`/obras/${obraId}/diario`);
  revalidatePath(`/obras/${obraId}/diario/${data}`);
  revalidatePath(`/portal/obras/${obraId}/diario`);
  return { error: null, success: true };
}

/**
 * Reabre um dia fechado. Limpa os snapshots (volta a refletir as outras telas)
 * e marca `reaberto_em` — o rastro de que o documento foi mexido depois de
 * fechado fica registrado.
 */
export async function reabrirDia(obraId: string, data: string): Promise<DiarioFormState> {
  await requireRole("engenheiro");
  const supabase = await createClient();

  const { error } = await supabase
    .from("diario_obra")
    .update({
      efetivo_snapshot: null,
      equipamentos_snapshot: null,
      tarefas_snapshot: null,
      entregas_snapshot: null,
      fechado_em: null,
      fechado_por: null,
      reaberto_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("obra_id", obraId)
    .eq("data", data);

  if (error) return { error: "Não foi possível reabrir o dia." };

  revalidatePath(`/obras/${obraId}/diario`);
  revalidatePath(`/obras/${obraId}/diario/${data}`);
  revalidatePath(`/portal/obras/${obraId}/diario`);
  return { error: null, success: true };
}

/** Marca (ou desmarca) o recebimento de uma entrega prevista para o dia. */
export async function confirmarRecebimento(
  obraId: string,
  data: string,
  parcelaId: string,
  recebido: boolean
) {
  await requireRole("engenheiro");
  const supabase = await createClient();

  await supabase
    .from("compra_parcelas")
    .update({ data_entrega_real: recebido ? data : null, updated_at: new Date().toISOString() })
    .eq("id", parcelaId);

  revalidatePath(`/obras/${obraId}/diario/${data}`);
  revalidatePath(`/obras/${obraId}/compras`);
}

/**
 * Registra fotos que o navegador **já enviou** para o Storage — daqui só passa
 * o caminho. As fotos não trafegam por esta ação porque, em produção, o limite
 * de payload da função (~4,5 MB depois do base64) não comporta algumas fotos de
 * celular; em desenvolvimento esse limite não existe e o problema não aparece.
 *
 * Como o arquivo já está no bucket quando chegamos aqui, qualquer falha de
 * validação precisa removê-lo — senão fica objeto órfão no Storage, sem
 * nenhuma linha apontando para ele.
 */
export async function registrarFotos(
  obraId: string,
  data: string,
  paths: string[],
  legenda: string | null
): Promise<DiarioFormState> {
  const profile = await requireRole("engenheiro");
  const supabase = await createClient();

  const limpar = async () => {
    if (paths.length) await supabase.storage.from("diario-obra").remove(paths);
  };

  if (!paths.length) return { error: "Selecione ao menos uma foto." };

  // Só aceita caminhos dentro da pasta desta obra/dia — o caminho vem do
  // cliente, então não dá para confiar nele de graça.
  const prefixoEsperado = `${obraId}/${data}/`;
  if (paths.some((p) => !p.startsWith(prefixoEsperado))) {
    await limpar();
    return { error: "Caminho de arquivo inválido." };
  }

  const existente = await garantirAberto(supabase, obraId, data);
  if (!existente) {
    await limpar();
    return { error: "Salve o diário antes de anexar fotos." };
  }
  if (existente.fechado) {
    await limpar();
    return { error: "Esse dia está fechado. Reabra para anexar fotos." };
  }

  const { error } = await supabase.from("diario_fotos").insert(
    paths.map((path) => ({
      diario_id: existente.id,
      obra_id: obraId,
      path,
      legenda,
      enviado_por: profile.id,
    }))
  );

  if (error) {
    await limpar();
    return { error: "Não foi possível registrar as fotos." };
  }

  revalidatePath(`/obras/${obraId}/diario/${data}`);
  return { error: null, success: true };
}

export async function removerFoto(obraId: string, data: string, fotoId: string) {
  await requireRole("engenheiro");
  const supabase = await createClient();

  const { data: foto } = await supabase
    .from("diario_fotos")
    .select("path")
    .eq("id", fotoId)
    .single();

  if (foto) {
    await supabase.storage.from("diario-obra").remove([foto.path]);
    await supabase.from("diario_fotos").delete().eq("id", fotoId);
  }

  revalidatePath(`/obras/${obraId}/diario/${data}`);
}

export async function removerDiario(obraId: string, data: string) {
  await requireRole("engenheiro");
  const supabase = await createClient();

  const { data: diario } = await supabase
    .from("diario_obra")
    .select("id")
    .eq("obra_id", obraId)
    .eq("data", data)
    .maybeSingle();

  if (diario) {
    const { data: fotos } = await supabase
      .from("diario_fotos")
      .select("path")
      .eq("diario_id", diario.id);

    if (fotos?.length) {
      await supabase.storage.from("diario-obra").remove(fotos.map((f) => f.path));
    }
    await supabase.from("diario_obra").delete().eq("id", diario.id);
  }

  revalidatePath(`/obras/${obraId}/diario`);
}
