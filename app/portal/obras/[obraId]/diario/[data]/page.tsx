import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { carregarRdo } from "@/lib/diario/carregar-rdo";
import { RdoDocumento } from "@/components/diario/rdo-documento";

const ISO_DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * O RDO do dia, para o cliente.
 *
 * É o mesmo documento que o engenheiro imprime — identificação, condições
 * climáticas, efetivo por função, atividades, ocorrências, fotos e a
 * assinatura do responsável técnico. Antes o cliente via um resumo em
 * cartões: os mesmos dados, arrumados de outro jeito e SEM assinatura, que é
 * justamente o que faz o RDO valer como documento. Ele também pode imprimir e
 * guardar o PDF, que é o que se faz com um relatório diário.
 *
 * A regra de acesso garante o resto: para o cliente, `diario_obra` só devolve
 * linha de obra dele e de dia FECHADO. Dia em rascunho não existe daqui.
 */
export default async function PortalDiarioDiaPage({
  params,
}: {
  params: Promise<{ obraId: string; data: string }>;
}) {
  const { obraId, data } = await params;
  if (!ISO_DATA.test(data)) notFound();

  const supabase = await createClient();

  const { data: diario } = await supabase
    .from("diario_obra")
    .select("*")
    .eq("obra_id", obraId)
    .eq("data", data)
    .maybeSingle();

  // Sem diário fechado não há documento. `notFound` e não uma tela vazia: do
  // ponto de vista do cliente, esse dia realmente não existe ainda.
  if (!diario) notFound();

  // Sem assinante de reserva: o dia aqui é sempre fechado, então quem assina
  // é sempre quem o fechou. Passar um palpite seria assinar documento alheio.
  const dados = await carregarRdo(supabase, obraId, data, diario, null);
  if (!dados) notFound();

  return (
    <div className="flex flex-col gap-3">
      {/* Fora da folha: no papel, o CSS de impressão esconde tudo que não é
          `.rdo`, então este botão não sai no PDF. */}
      <div>
        <Button
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="-ml-2"
          render={
            <Link href={`/portal/obras/${obraId}/diario`}>
              <ChevronLeft className="size-4" />
              Todos os dias
            </Link>
          }
        />
      </div>

      <RdoDocumento dados={dados} />
    </div>
  );
}
