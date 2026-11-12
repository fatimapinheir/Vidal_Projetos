import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { carregarRdo } from "@/lib/diario/carregar-rdo";
import { RdoDocumento } from "@/components/diario/rdo-documento";
import { tituloDoRdo } from "@/lib/diario/titulo-rdo";
import type { Metadata } from "next";

const ISO_DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * O RDO do dia, pronto para virar papel.
 *
 * A folha inteira mora em `RdoDocumento`, compartilhada com o portal: o
 * cliente abre exatamente este documento. Aqui sobra só o que é do
 * engenheiro — poder ver o dia ainda ABERTO, que a regra de acesso não
 * entrega para o cliente, e assinar como ele mesmo enquanto o dia não foi
 * fechado.
 */
/**
 * O título da página É o nome do arquivo PDF.
 *
 * O PDF sai da impressão do navegador, e o navegador sugere o `document.title`
 * como nome do arquivo. Definir isso em `generateMetadata`, e não no cliente,
 * cobre também quem imprime por Ctrl+P sem tocar no botão — e o título já vem
 * certo no primeiro byte, sem piscar o nome antigo.
 *
 * Uma consulta a mais, de uma coluna, numa tela que existe para virar
 * documento. O Next roda isto em paralelo com a página.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ obraId: string; data: string }>;
}): Promise<Metadata> {
  const { obraId, data } = await params;
  if (!ISO_DATA.test(data)) return {};

  const supabase = await createClient();
  const { data: obra } = await supabase
    .from("obras")
    .select("nome")
    .eq("id", obraId)
    .maybeSingle();

  return obra ? { title: tituloDoRdo(data, obra.nome) } : {};
}

export default async function RdoPage({
  params,
}: {
  params: Promise<{ obraId: string; data: string }>;
}) {
  const { obraId, data } = await params;
  if (!ISO_DATA.test(data)) notFound();

  const perfil = await requireRole("engenheiro");
  const supabase = await createClient();

  const { data: diario } = await supabase
    .from("diario_obra")
    .select("*")
    .eq("obra_id", obraId)
    .eq("data", data)
    .maybeSingle();

  const dados = await carregarRdo(supabase, obraId, data, diario, perfil.id);
  if (!dados) notFound();

  return <RdoDocumento dados={dados} />;
}
