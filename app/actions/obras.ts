"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-role";
import { CATEGORIAS_OBRA } from "@/lib/obra-cadastro";
import { parseNumeroBR } from "@/lib/parse-numero-br";
import { BUCKET_IMAGENS_OBRA, type CampoImagemObra } from "@/lib/obras/imagens";

/** Campo de texto opcional: string vazia do formulário vira null no banco. */
const textoOpcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null));

/** Inteiro não-negativo vindo de <input type="number">. */
const contagem = z.coerce.number().int().min(0).catch(0);

const obraSchema = z.object({
  nome: z.string().min(1, "Informe o nome da obra."),
  data_inicio: textoOpcional,
  data_fim_prevista: textoOpcional,

  // Localização
  cep: textoOpcional,
  logradouro: textoOpcional,
  numero: textoOpcional,
  complemento: textoOpcional,
  bairro: textoOpcional,
  cidade: textoOpcional,
  uf: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^[A-Z]{2}$/.test(v), "UF deve ter 2 letras."),
  link_maps: textoOpcional,

  // Dados municipais
  setor: textoOpcional,
  quadra: textoOpcional,
  lote: textoOpcional,
  cadastro_municipal: textoOpcional,
  alvara_construcao: textoOpcional,
  art_rrt_execucao: textoOpcional,
  cno: textoOpcional,

  // Características
  categoria: z.string().min(1).default(CATEGORIAS_OBRA[0]),
  tipo_obra_id: z.uuid().optional().nullable().catch(null),
  metragem_quadrada: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(parseNumeroBR(v)) : null))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0), "Metragem inválida."),
  padrao_acabamento: textoOpcional,
  faixa: textoOpcional,
  quartos: contagem,
  suites: contagem,
  banheiros: contagem,
  financiada: z.coerce.boolean().catch(false),
});

/**
 * Lê o formulário uma vez só.
 *
 * Criar e editar usam exatamente os mesmos campos; antes eram duas listas
 * iguais lado a lado, que é como uma delas acaba esquecida quando entra um
 * campo novo — e agora são 24.
 */
function lerFormulario(formData: FormData) {
  const texto = (campo: string) => (formData.get(campo) as string | null) ?? undefined;

  return obraSchema.safeParse({
    nome: texto("nome"),
    data_inicio: texto("data_inicio"),
    data_fim_prevista: texto("data_fim_prevista"),
    cep: texto("cep"),
    logradouro: texto("logradouro"),
    numero: texto("numero"),
    complemento: texto("complemento"),
    bairro: texto("bairro"),
    cidade: texto("cidade"),
    uf: texto("uf"),
    link_maps: texto("link_maps"),
    setor: texto("setor"),
    quadra: texto("quadra"),
    lote: texto("lote"),
    cadastro_municipal: texto("cadastro_municipal"),
    alvara_construcao: texto("alvara_construcao"),
    art_rrt_execucao: texto("art_rrt_execucao"),
    cno: texto("cno"),
    categoria: texto("categoria") || CATEGORIAS_OBRA[0],
    tipo_obra_id: texto("tipo_obra_id") || null,
    metragem_quadrada: texto("metragem_quadrada"),
    padrao_acabamento: texto("padrao_acabamento"),
    faixa: texto("faixa"),
    quartos: texto("quartos") ?? 0,
    suites: texto("suites") ?? 0,
    banheiros: texto("banheiros") ?? 0,
    // Checkbox do base-ui manda o `name` como valor, não "on".
    financiada: !!formData.get("financiada"),
  });
}

export type ObraFormState = { error: string | null; success?: boolean };

export async function createObra(
  _prevState: ObraFormState,
  formData: FormData
): Promise<ObraFormState> {
  const profile = await requireRole("engenheiro");

  const parsed = lerFormulario(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("obras")
    .insert({ ...parsed.data, criado_por: profile.id })
    .select("id")
    .single();

  if (error) {
    return { error: "Não foi possível criar a obra." };
  }

  // `?nova=1` faz a obra recém-criada abrir o modal de acesso do cliente.
  // A obra já está salva aqui: o convite depende de um e-mail sair, e falhar
  // nisso não pode desfazer um formulário de 27 campos.
  redirect(`/obras/${data.id}?nova=1`);
}

/** Edição dos dados da obra — é aqui que o cliente também é vinculado. */
export async function atualizarObra(
  obraId: string,
  _prevState: ObraFormState,
  formData: FormData
): Promise<ObraFormState> {
  await requireRole("engenheiro");

  const parsed = lerFormulario(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("obras")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", obraId);

  if (error) return { error: "Não foi possível salvar a obra." };

  revalidatePath(`/obras/${obraId}`);
  revalidatePath(`/obras/${obraId}/editar`);
  revalidatePath("/obras");
  return { error: null, success: true };
}

const statusSchema = z.enum(["planejamento", "em_andamento", "pausada", "concluida"]);

export async function updateObraStatus(obraId: string, formData: FormData) {
  await requireRole("engenheiro");
  const parsedStatus = statusSchema.parse(formData.get("status"));

  const supabase = await createClient();
  await supabase.from("obras").update({ status: parsedStatus }).eq("id", obraId);

  revalidatePath(`/obras/${obraId}`);
  revalidatePath("/obras");
  revalidatePath("/dashboard");
}

/**
 * Cria um tipo de obra a partir do botão "Novo tipo" do cadastro.
 *
 * Vive aqui e não numa tela de cadastro própria porque é no meio do
 * preenchimento da obra que a falta de um tipo aparece — mandar o engenheiro
 * para outra tela e voltar perderia o que ele já digitou.
 */
export async function criarTipoObra(
  _prevState: ObraFormState,
  formData: FormData
): Promise<ObraFormState> {
  await requireRole("engenheiro");

  const nome = (formData.get("nome") as string | null)?.trim();
  if (!nome) return { error: "Informe o nome do tipo." };

  const supabase = await createClient();
  const { error } = await supabase.from("obra_tipos").insert({ nome });

  if (error) {
    // `nome` é unique: o caso de longe mais comum é tentar criar um que já
    // existe, e "não foi possível" não ajudaria a entender isso.
    const duplicado = error.code === "23505";
    return { error: duplicado ? `Já existe um tipo chamado "${nome}".` : "Não foi possível criar o tipo." };
  }

  revalidatePath("/obras");
  return { error: null, success: true };
}

/* ------------------------------------------------------------------------- *
 * Exclusão de obra
 * ------------------------------------------------------------------------- */

export type ResumoExclusao = {
  nome: string;
  contagens: { rotulo: string; quantidade: number }[];
  /** Contas de cliente que serão apagadas junto (só as exclusivas desta obra). */
  clientesParaApagar: { id: string; nome: string; email: string }[];
  /** Clientes que ficam, porque têm outra obra. */
  clientesPreservados: { nome: string; email: string; outrasObras: number }[];
  arquivos: number;
};

/**
 * Tudo que será apagado junto com a obra, para a confirmação mostrar antes.
 *
 * Carregado só quando o diálogo abre, e não junto com o dashboard: são onze
 * consultas para uma ação que quase nunca acontece, e o dashboard lista todas
 * as obras.
 */
export async function resumoExclusaoObra(obraId: string): Promise<ResumoExclusao | { error: string }> {
  const perfil = await requireRole("engenheiro");
  const supabase = await createClient();

  const { data: obra } = await supabase
    .from("obras")
    .select("nome")
    .eq("id", obraId)
    .maybeSingle();

  if (!obra) return { error: "Obra não encontrada." };

  const contar = async (tabela: string) => {
    const { count } = await supabase
      .from(tabela as "compras")
      .select("*", { count: "exact", head: true })
      .eq("obra_id", obraId);
    return count ?? 0;
  };

  const [
    compras,
    diarios,
    fotos,
    tarefas,
    presencas,
    locacoes,
    orcamentos,
    fechamentos,
    entregas,
    avancos,
    trabalhadores,
    { data: vinculos },
    caminhos,
  ] = await Promise.all([
    contar("compras"),
    contar("diario_obra"),
    contar("diario_fotos"),
    contar("cronograma_tarefas"),
    contar("presencas"),
    contar("locacoes_equipamento"),
    contar("orcamento_versoes"),
    contar("fechamentos_periodo"),
    contar("fechamentos_entrega"),
    contar("avanco_registros"),
    contar("obra_trabalhadores"),
    supabase
      .from("obra_clientes")
      .select("cliente_id, profiles!inner(id, nome, email, role)")
      .eq("obra_id", obraId),
    arquivosDaObra(supabase, obraId),
  ]);

  // Parcelas não têm obra_id: penduram na compra.
  const { count: parcelas } = await supabase
    .from("compra_parcelas")
    .select("*, compras!inner(obra_id)", { count: "exact", head: true })
    .eq("compras.obra_id", obraId);

  const clientesParaApagar: ResumoExclusao["clientesParaApagar"] = [];
  const clientesPreservados: ResumoExclusao["clientesPreservados"] = [];

  for (const vinculo of vinculos ?? []) {
    const perfilCliente = vinculo.profiles as unknown as {
      id: string;
      nome: string;
      email: string;
      role: string;
    };

    // Nunca apaga conta de engenheiro, nem a de quem está excluindo: seria
    // destruir o próprio acesso ao sistema por um clique numa obra.
    if (perfilCliente.role !== "cliente" || perfilCliente.id === perfil.id) {
      clientesPreservados.push({
        nome: perfilCliente.nome,
        email: perfilCliente.email,
        outrasObras: 0,
      });
      continue;
    }

    const { count: outras } = await supabase
      .from("obra_clientes")
      .select("*", { count: "exact", head: true })
      .eq("cliente_id", perfilCliente.id)
      .neq("obra_id", obraId);

    if (outras && outras > 0) {
      clientesPreservados.push({
        nome: perfilCliente.nome,
        email: perfilCliente.email,
        outrasObras: outras,
      });
    } else {
      clientesParaApagar.push({
        id: perfilCliente.id,
        nome: perfilCliente.nome,
        email: perfilCliente.email,
      });
    }
  }

  const contagens = [
    { rotulo: "Ordens de compra", quantidade: compras },
    { rotulo: "Parcelas e pagamentos", quantidade: parcelas ?? 0 },
    { rotulo: "Diários de obra", quantidade: diarios },
    { rotulo: "Fotos do diário", quantidade: fotos },
    { rotulo: "Tarefas do cronograma", quantidade: tarefas },
    { rotulo: "Medições de avanço", quantidade: avancos },
    { rotulo: "Presenças lançadas", quantidade: presencas },
    { rotulo: "Fechamentos de folha", quantidade: fechamentos + entregas },
    { rotulo: "Locações de equipamento", quantidade: locacoes },
    { rotulo: "Versões de orçamento", quantidade: orcamentos },
    { rotulo: "Trabalhadores alocados", quantidade: trabalhadores },
  ].filter((linha) => linha.quantidade > 0);

  return {
    nome: obra.nome,
    contagens,
    clientesParaApagar,
    clientesPreservados,
    arquivos: caminhos.reduce((soma, b) => soma + b.paths.length, 0),
  };
}

/**
 * Arquivos no Storage que pertencem a esta obra.
 *
 * Sai dos caminhos gravados no banco, não da convenção de pasta: os prefixos
 * divergem entre buckets (o diário usa `obra/data`, a cotação usa só `obra`) e
 * um deles mudar deixaria arquivo pago para trás sem ninguém notar. O que está
 * na coluna é o que existe.
 *
 * `assinaturas` e `sinapi` ficam de fora de propósito: são do usuário e
 * globais, não da obra.
 */
async function arquivosDaObra(
  supabase: Awaited<ReturnType<typeof createClient>>,
  obraId: string
): Promise<{ bucket: string; paths: string[] }[]> {
  const [cotacoes, anexosCompra, comprovantes, fotos, planilhas, folha, entrega] =
    await Promise.all([
    supabase
      .from("compras")
      .select("anexo_cotacao_path")
      .eq("obra_id", obraId)
      .not("anexo_cotacao_path", "is", null),
    // Anexos da compra (até três por ordem/lançamento, migração 0048). Cada
    // linha diz em qual bucket mora — ver lib/compras/anexos.
    supabase
      .from("compra_anexos")
      .select("bucket, path, compras!inner(obra_id)")
      .eq("compras.obra_id", obraId),
    supabase
      .from("compra_parcelas")
      .select("comprovante_pagamento_path, compras!inner(obra_id)")
      .eq("compras.obra_id", obraId)
      .not("comprovante_pagamento_path", "is", null),
    supabase.from("diario_fotos").select("path").eq("obra_id", obraId),
    supabase
      .from("orcamento_versoes")
      .select("arquivo_original_path")
      .eq("obra_id", obraId),
    supabase
      .from("fechamentos_periodo")
      .select("comprovante_path")
      .eq("obra_id", obraId)
      .not("comprovante_path", "is", null),
    supabase
      .from("fechamentos_entrega")
      .select("comprovante_path")
      .eq("obra_id", obraId)
      .not("comprovante_path", "is", null),
  ]);

  const limpar = (valores: (string | null)[]) =>
    valores.filter((v): v is string => !!v && v.trim() !== "");

  const anexosEm = (bucket: string) =>
    (anexosCompra.data ?? []).filter((a) => a.bucket === bucket).map((a) => a.path);

  return [
    {
      bucket: "cotacoes",
      paths: limpar([
        ...(cotacoes.data ?? []).map((c) => c.anexo_cotacao_path),
        ...anexosEm("cotacoes"),
      ]),
    },
    {
      bucket: "comprovantes-pagamento",
      paths: limpar([
        ...(comprovantes.data ?? []).map((p) => p.comprovante_pagamento_path),
        ...anexosEm("comprovantes-pagamento"),
      ]),
    },
    { bucket: "diario-obra", paths: limpar((fotos.data ?? []).map((f) => f.path)) },
    { bucket: "orcamentos", paths: limpar((planilhas.data ?? []).map((v) => v.arquivo_original_path)) },
    {
      bucket: "comprovantes-fechamento",
      paths: [
        ...limpar((folha.data ?? []).map((f) => f.comprovante_path)),
        ...limpar((entrega.data ?? []).map((f) => f.comprovante_path)),
      ],
    },
  ].filter((b) => b.paths.length > 0);
}

export type ExclusaoResultado = { error: string | null; avisos?: string[] };

/**
 * Apaga a obra e tudo que pende dela.
 *
 * As dezesseis tabelas que referenciam `obras` são todas `on delete cascade`,
 * então o banco inteiro da obra sai num `delete`. Fora do cascade sobram duas
 * coisas, e são elas que esta função existe para resolver:
 *
 * - os arquivos no Storage, que ninguém apaga por nós;
 * - a conta do cliente no Auth, que `obra_clientes` só desvincula.
 *
 * Ordem importa: os caminhos dos arquivos são lidos ANTES do delete (depois
 * dele não há mais onde ler), o delete vem em seguida, e a limpeza do Storage
 * por último. O inverso — apagar arquivo primeiro — deixaria o banco apontando
 * para arquivo inexistente se o delete falhasse, que é pior que sobrar arquivo
 * órfão num bucket privado.
 *
 * Exige o nome digitado porque não há desfazer: é a última barreira entre um
 * clique errado e a obra inteira.
 */
export async function excluirObra(
  obraId: string,
  nomeConfirmado: string
): Promise<ExclusaoResultado> {
  const perfil = await requireRole("engenheiro");
  const supabase = await createClient();

  const { data: obra } = await supabase
    .from("obras")
    .select("nome")
    .eq("id", obraId)
    .maybeSingle();

  if (!obra) return { error: "Obra não encontrada." };

  if (nomeConfirmado.trim() !== obra.nome.trim()) {
    return { error: "O nome digitado não é igual ao da obra." };
  }

  // Lido antes do delete: depois do cascade não há mais de onde tirar.
  const arquivos = await arquivosDaObra(supabase, obraId);

  const { data: vinculos } = await supabase
    .from("obra_clientes")
    .select("cliente_id, profiles!inner(id, nome, email, role)")
    .eq("obra_id", obraId);

  const candidatos: { id: string; nome: string; email: string }[] = [];
  for (const vinculo of vinculos ?? []) {
    const perfilCliente = vinculo.profiles as unknown as {
      id: string;
      nome: string;
      email: string;
      role: string;
    };
    // Conta de engenheiro nunca sai por aqui, nem a de quem está excluindo:
    // seria destruir o próprio acesso ao sistema por um clique numa obra.
    if (perfilCliente.role !== "cliente") continue;
    if (perfilCliente.id === perfil.id) continue;

    const { count: outras } = await supabase
      .from("obra_clientes")
      .select("*", { count: "exact", head: true })
      .eq("cliente_id", perfilCliente.id)
      .neq("obra_id", obraId);

    // Cliente com outra obra fica: apagá-lo tiraria o acesso dele de uma obra
    // que ninguém pediu para excluir.
    if (!outras) {
      candidatos.push({
        id: perfilCliente.id,
        nome: perfilCliente.nome,
        email: perfilCliente.email,
      });
    }
  }

  const { error: erroDelete } = await supabase.from("obras").delete().eq("id", obraId);
  if (erroDelete) return { error: "Não foi possível excluir a obra." };

  const avisos: string[] = [];

  for (const { bucket, paths } of arquivos) {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    // A obra já foi. Falha aqui não desfaz nada — só deixa arquivo órfão num
    // bucket privado, e o engenheiro precisa saber para poder limpar à mão.
    if (error) {
      avisos.push(`${paths.length} arquivo(s) em "${bucket}" não foram removidos do Storage.`);
    }
  }

  if (candidatos.length) {
    // Apagar usuário do Auth é operação administrativa: só a chave de serviço
    // pode. O profile sai junto, por `profiles.id references auth.users(id) on
    // delete cascade`.
    const admin = createAdminClient();
    for (const cliente of candidatos) {
      const { error } = await admin.auth.admin.deleteUser(cliente.id);
      if (!error) continue;

      /*
       * Quinze colunas de histórico apontam para `profiles` com NO ACTION
       * (`compras.aprovado_por`, `presencas.registrado_por`, e assim por
       * diante). As desta obra já saíram no cascade, mas se a pessoa deixou
       * rastro em obra de onde foi desvinculada, o banco recusa — e recusar é o
       * certo: apagar levaria embora quem aprovou uma compra que ainda existe.
       *
       * A obra já foi excluída de qualquer forma. O que fica é a conta, e o
       * engenheiro precisa saber disso para não achar que o acesso foi cortado.
       */
      avisos.push(
        `A conta de ${cliente.nome} (${cliente.email}) não pôde ser apagada: ela ainda ` +
          `assina registros de outra obra. O acesso dela a esta obra acabou, mas o login continua.`
      );
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/obras");
  revalidatePath("/clientes");
  return { error: null, avisos: avisos.length ? avisos : undefined };
}

/* -------------------------------------------------------------------------
 * Imagens da obra
 *
 * O arquivo sobe direto do navegador para o Storage (ver
 * `lib/storage/upload-direto`); por aqui passa só o caminho. Estas ações
 * guardam esse caminho na obra e apagam o arquivo anterior — sem isso, cada
 * troca de capa deixaria o arquivo velho no bucket, sem referência e ocupando
 * espaço pago.
 * ---------------------------------------------------------------------- */

/**
 * Lê o caminho atual e monta o patch da coluna certa.
 *
 * Chave computada (`{ [coluna]: valor }`) não passa no tipo gerado do banco —
 * o Supabase recusa índice de string em `update`. O ternário explícito custa
 * duas linhas e devolve a checagem de tipo.
 */
async function lerEMontar(
  supabase: Awaited<ReturnType<typeof createClient>>,
  obraId: string,
  campo: CampoImagemObra,
  valor: string | null
) {
  const { data } = await supabase
    .from("obras")
    .select("imagem_capa_path, imagem_rdo_path")
    .eq("id", obraId)
    .maybeSingle();

  const anterior =
    campo === "capa" ? (data?.imagem_capa_path ?? null) : (data?.imagem_rdo_path ?? null);

  const patch =
    campo === "capa"
      ? { imagem_capa_path: valor, updated_at: new Date().toISOString() }
      : { imagem_rdo_path: valor, updated_at: new Date().toISOString() };

  return { anterior, patch };
}

export async function salvarImagemObra(
  obraId: string,
  campo: CampoImagemObra,
  path: string
): Promise<{ error: string | null }> {
  await requireRole("engenheiro");

  const supabase = await createClient();
  const { anterior, patch } = await lerEMontar(supabase, obraId, campo, path);

  const { error } = await supabase.from("obras").update(patch).eq("id", obraId);

  if (error) return { error: "Não foi possível salvar a imagem." };

  // Só depois de a troca estar gravada: se a remoção viesse antes e o update
  // falhasse, a obra ficaria apontando para um arquivo que não existe mais.
  if (anterior && anterior !== path) {
    await supabase.storage.from(BUCKET_IMAGENS_OBRA).remove([anterior]);
  }

  revalidatePath(`/obras/${obraId}`);
  revalidatePath(`/portal/obras/${obraId}`);
  return { error: null };
}

export async function removerImagemObra(
  obraId: string,
  campo: CampoImagemObra
): Promise<{ error: string | null }> {
  await requireRole("engenheiro");

  const supabase = await createClient();
  const { anterior, patch } = await lerEMontar(supabase, obraId, campo, null);

  const { error } = await supabase.from("obras").update(patch).eq("id", obraId);

  if (error) return { error: "Não foi possível remover a imagem." };

  if (anterior) await supabase.storage.from(BUCKET_IMAGENS_OBRA).remove([anterior]);

  revalidatePath(`/obras/${obraId}`);
  revalidatePath(`/portal/obras/${obraId}`);
  return { error: null };
}
