import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type LembreteAtivo = {
  tarefaId: string;
  nome: string;
  obraId: string;
  obraNome: string;
  dataInicio: string;
  alertaEm: string;
};

function subtrairDias(dataIso: string, dias: number): string {
  const data = new Date(`${dataIso}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() - dias);
  return data.toISOString().slice(0, 10);
}

/**
 * Busca tarefas com lembrete configurado cuja data de alerta já chegou (hoje
 * >= início previsto - dias de antecedência) e que ainda não começaram de
 * verdade. Passe `obraId` pra restringir a uma obra só, ou omita pra ver de
 * todas (uso no dashboard do engenheiro).
 */
export async function buscarLembretesAtivos(
  supabase: SupabaseClient,
  filtro?: { obraId?: string }
): Promise<LembreteAtivo[]> {
  let query = supabase
    .from("cronograma_tarefas")
    .select("id, nome, obra_id, data_inicio_cedo, data_inicio_real, lembrete_dias_antes, obras(nome)")
    .not("lembrete_dias_antes", "is", null)
    .is("data_inicio_real", null)
    .not("data_inicio_cedo", "is", null);

  if (filtro?.obraId) query = query.eq("obra_id", filtro.obraId);

  const { data } = await query;
  const hojeIso = new Date().toISOString().slice(0, 10);

  return (data ?? [])
    .map((t) => {
      const obra = t.obras as unknown as { nome: string } | null;
      return {
        tarefaId: t.id,
        nome: t.nome,
        obraId: t.obra_id,
        obraNome: obra?.nome ?? "",
        dataInicio: t.data_inicio_cedo!,
        alertaEm: subtrairDias(t.data_inicio_cedo!, t.lembrete_dias_antes!),
      };
    })
    .filter((l) => hojeIso >= l.alertaEm)
    .sort((a, b) => a.alertaEm.localeCompare(b.alertaEm));
}
