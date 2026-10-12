import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { carregarRdo } from "@/lib/diario/carregar-rdo";
import { RdoDocumento } from "@/components/diario/rdo-documento";

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
