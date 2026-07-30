import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { ObraTabs } from "./obra-tabs";

const statusLabel: Record<string, string> = {
  planejamento: "Planejamento",
  em_andamento: "Em andamento",
  pausada: "Pausada",
  concluida: "Concluída",
};

export default async function ObraLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const supabase = await createClient();
  const { data: obra } = await supabase.from("obras").select("*").eq("id", obraId).single();

  if (!obra) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-heading text-lg font-semibold">{obra.nome}</h1>
          <p className="text-sm text-muted-foreground">{obra.endereco ?? "Sem endereço"}</p>
        </div>
        <Badge>{statusLabel[obra.status]}</Badge>
      </div>
      <ObraTabs obraId={obraId} />
      {children}
    </div>
  );
}
