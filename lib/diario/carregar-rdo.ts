import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatarEndereco } from "@/lib/obra-cadastro";
import { derivarConteudoDia, efetivoConfirmado, type EfetivoItem } from "@/lib/diario/montar-dia";
import type { DiarioCondicao, Tables } from "@/lib/types/database.types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type LinhaEfetivo = { funcao: string; total: number };
export type FotoRdo = { url: string | null; legenda: string | null };

export type DadosRdo = {
  data: string;
  obraNome: string;
  local: string;
  contratante: string;
  responsavel: { nome: string; crea: string | null };
  assinaturaUrl: string | null;
  temperatura: number | null;
  umidade: number | null;
  condicaoDia: DiarioCondicao | null;
  efetivo: LinhaEfetivo[];
  totalEfetivo: number;
  atividades: string | null;
  ocorrencias: string | null;
  fotos: FotoRdo[];
};

/**
 * Agrupa o efetivo por função, que é como o RDO pede.
 *
 * O diário guarda pessoas; o relatório mostra quantas de cada função. Faltas
 * ficam de fora: o RDO declara quem esteve em obra, e contar ausente inflaria
 * o efetivo do dia.
 */
function porFuncao(efetivo: EfetivoItem[]): LinhaEfetivo[] {
  const mapa = new Map<string, number>();
  for (const p of efetivo) {
    if (p.status === "falta") continue;
    const chave = p.funcao?.trim() || "Não informada";
    // Meia diária conta meio: é o que o fechamento de folha já considera.
    mapa.set(chave, (mapa.get(chave) ?? 0) + (p.status === "meia_diaria" ? 0.5 : 1));
  }
  return [...mapa.entries()]
    .map(([funcao, total]) => ({ funcao, total }))
    .sort((a, b) => a.funcao.localeCompare(b.funcao, "pt-BR"));
}

/**
 * Monta o relatório diário de obra, igual para o engenheiro e para o cliente.
 *
 * Duas coisas do RDO não passam pela RLS de quem está olhando:
 *
 * 1. **O perfil de quem assina.** O cliente só enxerga o próprio `profiles`
 *    (`cli_select_own_profile`), então nome e CREA do responsável técnico
 *    voltariam vazios para ele.
 * 2. **A imagem da assinatura.** O bucket só libera para o dono do arquivo —
 *    a migração que o criou já anotou que "quem precisa dela para montar o
 *    RDO é o servidor, que usa a chave de serviço".
 *
 * Por isso estes dois campos saem do client administrativo. O que autoriza
 * isso não é a chave: é a ORDEM. Quem chama já leu o diário com a sessão do
 * próprio usuário e só chega aqui se a RLS tiver devolvido a linha — para o
 * cliente, isso significa obra dele e dia fechado. O administrativo é usado
 * depois disso, e só para dois campos públicos de um documento que a pessoa
 * já tem direito de ler.
 */
export async function carregarRdo(
  supabase: SupabaseClient,
  obraId: string,
  data: string,
  diario: Tables<"diario_obra"> | null,
  /** Quem assina quando o dia ainda não foi fechado — o engenheiro na tela. */
  assinanteFallback: string | null
): Promise<DadosRdo | null> {
  const { data: obra } = await supabase.from("obras").select("*").eq("id", obraId).single();
  if (!obra) return null;

  const [{ data: vinculos }, { data: fotos }, conteudo] = await Promise.all([
    supabase.from("obra_clientes").select("profiles(nome)").eq("obra_id", obraId),
    diario
      ? supabase.from("diario_fotos").select("path, legenda").eq("diario_id", diario.id)
      : Promise.resolve({ data: null }),
    // Dia fechado usa o congelado; aberto, o que o sistema sabe agora.
    diario?.fechado_em ? Promise.resolve(null) : derivarConteudoDia(supabase, obraId, data),
  ]);

  const contratante =
    (vinculos ?? [])
      .map((v) => (v.profiles as unknown as { nome: string } | null)?.nome)
      .filter(Boolean)
      .join(", ") || "—";

  // No dia aberto o efetivo traz a equipe inteira, inclusive quem ainda não foi
  // confirmado — isso serve para dar onde clicar na folha, não para o
  // relatório. Aqui só entra quem tem presença lançada.
  const efetivoBruto = (diario?.efetivo_snapshot ?? conteudo?.efetivo ?? []) as EfetivoItem[];
  const efetivo = porFuncao(efetivoConfirmado(efetivoBruto));

  const fotosComUrl = await Promise.all(
    (fotos ?? []).map(async (f) => {
      const { data: url } = await supabase.storage
        .from("diario-obra")
        .createSignedUrl(f.path, 60 * 30);
      return { url: url?.signedUrl ?? null, legenda: f.legenda };
    })
  );

  // Quem assina é quem FECHOU o dia, não quem está lendo a tela: o RDO é um
  // documento datado, e trocar a assinatura conforme o leitor o descaracteriza.
  const assinanteId = diario?.fechado_por ?? assinanteFallback;
  const admin = createAdminClient();

  let responsavel = { nome: "—", crea: null as string | null };
  let assinaturaUrl: string | null = null;

  if (assinanteId) {
    const { data: perfil } = await admin
      .from("profiles")
      .select("nome, crea, assinatura_path")
      .eq("id", assinanteId)
      .maybeSingle();

    if (perfil) {
      responsavel = { nome: perfil.nome, crea: perfil.crea };
      if (perfil.assinatura_path) {
        const { data: url } = await admin.storage
          .from("assinaturas")
          .createSignedUrl(perfil.assinatura_path, 60 * 30);
        assinaturaUrl = url?.signedUrl ?? null;
      }
    }
  }

  return {
    data,
    obraNome: obra.nome,
    local: formatarEndereco(obra) ?? "—",
    contratante,
    responsavel,
    assinaturaUrl,
    temperatura: diario?.temperatura ?? null,
    umidade: diario?.umidade ?? null,
    condicaoDia: diario?.clima ?? null,
    efetivo,
    totalEfetivo: efetivo.reduce((s, e) => s + e.total, 0),
    atividades: diario?.atividades ?? null,
    ocorrencias: diario?.ocorrencias ?? null,
    fotos: fotosComUrl,
  };
}
