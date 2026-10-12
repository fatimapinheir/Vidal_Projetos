import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarX2, ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { carregarRdo } from "@/lib/diario/carregar-rdo";
import { RdoDocumento } from "@/components/diario/rdo-documento";
import { formatDateBR } from "@/lib/format-date";
import { hojeNoFuso } from "@/lib/fuso";

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
 * linha de obra dele e de dia FECHADO. Dia em rascunho não existe daqui — e é
 * por isso que a tela de "sem RDO" abaixo não distingue rascunho de nada: do
 * ponto de vista do cliente, as duas situações são a mesma.
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

  /*
   * Sem diário, a tela EXPLICA em vez de dar 404.
   *
   * Era `notFound()`. Fazia sentido quando só se chegava aqui por um link do
   * calendário de dias publicados; agora o calendário deixa clicar em
   * qualquer dia passado, e justamente o dia sem registro é o que o cliente
   * quer conferir. "Página não encontrada" responderia a pergunta errada —
   * sugere defeito no sistema, não ausência de lançamento.
   */
  if (!diario) {
    return <SemRdo obraId={obraId} data={data} />;
  }

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

function SemRdo({ obraId, data }: { obraId: string; data: string }) {
  const noFuturo = data > hojeNoFuso();

  return (
    <div className="flex flex-col gap-3">
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

      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
        <CalendarX2 className="size-7 text-muted-foreground" aria-hidden />
        <div>
          <p className="font-heading text-lg font-semibold">{formatDateBR(data)}</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {noFuturo
              ? "Esta data ainda não chegou. O RDO é publicado ao fim de cada dia de trabalho."
              : "Não há RDO registrado pelo engenheiro neste dia."}
          </p>
        </div>
        <Button
          nativeButton={false}
          variant="outline"
          size="sm"
          render={
            <Link href={`/portal/obras/${obraId}/diario?mes=${data.slice(0, 7)}`}>
              Ver o calendário do mês
            </Link>
          }
        />
      </div>
    </div>
  );
}
