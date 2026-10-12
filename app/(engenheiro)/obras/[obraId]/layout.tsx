import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { SeletorObra } from "@/components/obras/seletor-obra";
import { LembrarObraAtiva } from "@/components/obras/lembrar-obra-ativa";
import { formatarEndereco } from "@/lib/obra-cadastro";

const statusLabel: Record<string, string> = {
  planejamento: "Planejamento",
  em_andamento: "Em andamento",
  pausada: "Pausada",
  concluida: "Concluída",
};

/**
 * Moldura de toda tela de dentro de uma obra.
 *
 * As seções saíram daqui para a barra lateral, então o que sobra no topo é a
 * identificação da obra — e o seletor, que é como se troca de obra sem perder
 * a seção em que você está.
 */
export default async function ObraLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const supabase = await createClient();

  const [{ data: obra }, { data: obras }] = await Promise.all([
    supabase.from("obras").select("*").eq("id", obraId).single(),
    supabase.from("obras").select("id, nome").order("nome"),
  ]);

  if (!obra) notFound();

  return (
    <div className="flex flex-col gap-4">
      <LembrarObraAtiva obraId={obraId} />

      <div className="flex flex-col gap-3 border-b pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SeletorObra obras={obras ?? []} obraId={obraId} />
          <Badge>{statusLabel[obra.status]}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{formatarEndereco(obra) ?? "Sem endereço"}</p>
      </div>

      {children}
    </div>
  );
}
