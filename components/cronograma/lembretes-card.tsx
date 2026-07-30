import Link from "next/link";
import { Bell } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatDateBR } from "@/lib/format-date";
import type { LembreteAtivo } from "@/lib/cronograma/lembretes";

export function LembretesCard({
  lembretes,
  mostrarObra = false,
}: {
  lembretes: LembreteAtivo[];
  mostrarObra?: boolean;
}) {
  if (!lembretes.length) return null;

  return (
    <Card className="border-atencao/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="size-4 text-atencao" />
          Lembretes
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {lembretes.map((l) => (
          <Link
            key={l.tarefaId}
            href={`/obras/${l.obraId}/cronograma`}
            className="flex flex-col gap-1 rounded-lg border border-atencao/30 bg-atencao/5 p-3 text-sm transition-colors hover:bg-atencao/10 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
          >
            <div>
              <p className="font-medium">{l.nome}</p>
              {mostrarObra && <p className="text-muted-foreground">{l.obraNome}</p>}
              <p className="text-xs text-muted-foreground">Início previsto: {formatDateBR(l.dataInicio)}</p>
            </div>
            <span className="font-medium text-atencao">
              Alertar desde {formatDateBR(l.alertaEm)}
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
