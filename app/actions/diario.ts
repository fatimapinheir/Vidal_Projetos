"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { derivarConteudoDia, efetivoConfirmado } from "@/lib/diario/montar-dia";

export type DiarioFormState = { error: string | null; success?: boolean };

const climaValues = ["ensolarado", "nublado", "chuvoso", "chuva_forte"] as const;

const climaOpcional = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.enum(climaValues).optional()
);

const textoOpcional = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().optional()
);

const diarioSchema = z.object({
  clima: climaOpcional,
  // Medidas do RDO. Vazio vira null: documento com temperatura zerada por
  // omissão seria pior que documento sem o campo.
  temperatura: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().min(-20).max(60).optional()
  ),
  umidade: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int().min(0).max(100).optional()
  ),
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
    temperatura: formData.get("temperatura"),
    umidade: formData.get("umidade"),
    clima: formData.get("clima"),
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
    temperatura: parsed.data.temperatura ?? null,
    umidade: parsed.data.umidade ?? null,
    clima: parsed.data.clima ?? null,
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
      // Igual às entregas: o id sai do congelado, porque ele serve para
      // confirmar presença e folha fechada não aceita mais essa ação. E só
      // entra quem foi confirmado — a equipe sem lançamento era só apoio ao
      // preenchimento, não declaração de que a pessoa esteve em obra.
      efetivo_snapshot: efetivoConfirmado(conteudo.efetivo).map((pessoa) => ({
        nome: pessoa.nome,
        funcao: pessoa.funcao ?? null,
        status: pessoa.status,
        observacoes: pessoa.observacoes ?? null,
      })),
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

const presencaStatusSchema = z.enum(["presente", "falta", "meia_diaria"]);

/**
 * A equipe ativa da obra e quem já tem presença lançada no dia.
 *
 * Os dois conjuntos juntos dizem quem pode receber lançamento: o id vem do
 * navegador, então sem essa checagem uma requisição forjada gravaria presença
 * para qualquer pessoa do banco — e essa presença entraria no cálculo de dias
 * do fechamento de folha. "Já lançados" entra na conta porque quem trabalhou e
 * depois saiu da equipe continua aparecendo no dia em que trabalhou, e precisa
 * poder ser corrigido.
 */
async function equipeDoDia(
  supabase: Awaited<ReturnType<typeof createClient>>,
  obraId: string,
  data: string
): Promise<{ alocados: Set<string>; jaLancados: Set<string> }> {
  const [{ data: alocados }, { data: lancados }] = await Promise.all([
    supabase
      .from("obra_trabalhadores")
      .select("trabalhador_id")
      .eq("obra_id", obraId)
      .eq("ativo", true),
    supabase
      .from("presencas")
      .select("trabalhador_id")
      .eq("obra_id", obraId)
      .eq("data", data),
  ]);

  return {
    alocados: new Set((alocados ?? []).map((a) => a.trabalhador_id)),
    jaLancados: new Set((lancados ?? []).map((p) => p.trabalhador_id)),
  };
}

/**
 * Confirma a presença de uma pessoa direto na folha do dia.
 *
 * Existe para não obrigar a sair do diário e ir à tela de presenças só para
 * dizer quem estava em obra: a folha já lista a equipe, e é nela que o
 * engenheiro está olhando quando fecha o dia. Grava na mesma tabela
 * `presencas` — não é um registro paralelo, então fechamento de folha e
 * relatórios continuam lendo de um lugar só.
 */
export async function confirmarPresencaNoDiario(
  obraId: string,
  data: string,
  trabalhadorId: string,
  status: string
): Promise<DiarioFormState> {
  const profile = await requireRole("engenheiro");

  const parsed = presencaStatusSchema.safeParse(status);
  if (!parsed.success) return { error: "Status de presença inválido." };

  const supabase = await createClient();

  const existente = await garantirAberto(supabase, obraId, data);
  if (existente?.fechado) {
    return { error: "Esse dia está fechado. Reabra antes de mexer no efetivo." };
  }

  const { alocados, jaLancados } = await equipeDoDia(supabase, obraId, data);
  if (!alocados.has(trabalhadorId) && !jaLancados.has(trabalhadorId)) {
    return { error: "Essa pessoa não está alocada nesta obra." };
  }

  // Corrigir é `update` de uma coluna só, não `upsert`: a observação do dia
  // pode ter sido escrita na tela de presenças, e trocar "presente" por "meia
  // diária" daqui não tem por que apagá-la.
  const { error } = jaLancados.has(trabalhadorId)
    ? await supabase
        .from("presencas")
        .update({ status: parsed.data, registrado_por: profile.id })
        .eq("obra_id", obraId)
        .eq("data", data)
        .eq("trabalhador_id", trabalhadorId)
    : await supabase.from("presencas").insert({
        obra_id: obraId,
        trabalhador_id: trabalhadorId,
        data,
        status: parsed.data,
        registrado_por: profile.id,
      });

  if (error) return { error: "Não foi possível salvar a presença." };

  revalidatePath(`/obras/${obraId}/diario/${data}`);
  revalidatePath(`/obras/${obraId}/presencas`);
  return { error: null, success: true };
}

/**
 * Marca como presente todo mundo da equipe que ainda não tem lançamento no dia.
 *
 * É o caminho do dia normal — equipe inteira em obra —, em que confirmar um por
 * um é só digitação. Quem já foi lançado não é tocado: o atalho não pode
 * desfazer uma falta registrada antes.
 */
export async function confirmarEquipeInteira(
  obraId: string,
  data: string
): Promise<DiarioFormState> {
  const profile = await requireRole("engenheiro");
  const supabase = await createClient();

  const existente = await garantirAberto(supabase, obraId, data);
  if (existente?.fechado) {
    return { error: "Esse dia está fechado. Reabra antes de mexer no efetivo." };
  }

  const { alocados, jaLancados } = await equipeDoDia(supabase, obraId, data);
  const faltando = [...alocados].filter((id) => !jaLancados.has(id));

  if (!faltando.length) return { error: null, success: true };

  const { error } = await supabase.from("presencas").insert(
    faltando.map((trabalhadorId) => ({
      obra_id: obraId,
      trabalhador_id: trabalhadorId,
      data,
      status: "presente" as const,
      registrado_por: profile.id,
    }))
  );

  if (error) return { error: "Não foi possível confirmar a equipe." };

  revalidatePath(`/obras/${obraId}/diario/${data}`);
  revalidatePath(`/obras/${obraId}/presencas`);
  return { error: null, success: true };
}

/** Remove o lançamento de presença de uma pessoa, devolvendo a linha a "sem confirmar". */
export async function limparPresencaNoDiario(
  obraId: string,
  data: string,
  trabalhadorId: string
): Promise<DiarioFormState> {
  await requireRole("engenheiro");
  const supabase = await createClient();

  const existente = await garantirAberto(supabase, obraId, data);
  if (existente?.fechado) {
    return { error: "Esse dia está fechado. Reabra antes de mexer no efetivo." };
  }

  const { error } = await supabase
    .from("presencas")
    .delete()
    .eq("obra_id", obraId)
    .eq("data", data)
    .eq("trabalhador_id", trabalhadorId);

  if (error) return { error: "Não foi possível limpar a presença." };

  revalidatePath(`/obras/${obraId}/diario/${data}`);
  revalidatePath(`/obras/${obraId}/presencas`);
  return { error: null, success: true };
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
  paths: string[]
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
      // Entra sem legenda: o envio é em lote e exigir texto por foto trava o
      // registro do dia. Dá para escrever depois, foto por foto, na própria
      // folha — e o RDO só imprime a legenda de quem tiver uma.
      legenda: null,
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

/** Escreve (ou apaga, com texto vazio) a legenda de uma foto já enviada. */
export async function salvarLegendaFoto(
  obraId: string,
  data: string,
  fotoId: string,
  legenda: string
): Promise<DiarioFormState> {
  await requireRole("engenheiro");
  const supabase = await createClient();

  const existente = await garantirAberto(supabase, obraId, data);
  if (!existente) return { error: "Salve o diário antes de editar as legendas." };
  if (existente.fechado) {
    return { error: "Esse dia está fechado. Reabra para editar as legendas." };
  }

  const texto = legenda.trim();
  const { error } = await supabase
    .from("diario_fotos")
    .update({ legenda: texto || null })
    .eq("id", fotoId)
    // A foto tem de ser deste dia: o id vem do navegador.
    .eq("diario_id", existente.id);

  if (error) return { error: "Não foi possível salvar a legenda." };

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
