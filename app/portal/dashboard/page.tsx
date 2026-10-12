import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatarEndereco } from "@/lib/obra-cadastro";

type ObraDoPortal = {
  id: string;
  nome: string;
  status: string;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
};

const statusLabel: Record<string, string> = {
  planejamento: "Planejamento",
  em_andamento: "Em andamento",
  pausada: "Pausada",
  concluida: "Concluída",
};

export default async function PortalDashboardPage() {
  const supabase = await createClient();

  const { data: vinculos } = await supabase
    .from("obra_clientes")
    .select("obra_id, obras(id, nome, status, logradouro, numero, complemento, bairro, cidade, uf)");

  const obras = (vinculos ?? [])
    .map((v) => v.obras as unknown as ObraDoPortal | null)
    .filter((o): o is NonNullable<typeof o> => Boolean(o));

  if (obras.length === 1) {
    redirect(`/portal/obras/${obras[0].id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-lg font-semibold">Suas obras</h1>
        <p className="text-sm text-muted-foreground">Selecione uma obra para acompanhar.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {obras.map((obra) => (
          <Link key={obra.id} href={`/portal/obras/${obra.id}`}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium">{obra.nome}</p>
                  <p className="text-sm text-muted-foreground">{formatarEndereco(obra) ?? "Sem endereço"}</p>
                </div>
                <Badge variant="outline">{statusLabel[obra.status]}</Badge>
              </CardContent>
            </Card>
          </Link>
        ))}
        {!obras.length && (
          <p className="text-sm text-muted-foreground">
            Nenhuma obra vinculada à sua conta ainda. Fale com seu engenheiro responsável.
          </p>
        )}
      </div>
    </div>
  );
}
