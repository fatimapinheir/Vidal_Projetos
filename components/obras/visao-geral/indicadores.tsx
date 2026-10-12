import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Tom do indicador. É semáforo, não decoração: `alerta` e `critico` existem
 * para dizer "olhe aqui", então pintar o que está normal mataria o efeito —
 * se tudo chama atenção, nada chama.
 */
export type Tom = "neutro" | "bom" | "alerta" | "critico";

const tons: Record<Tom, { valor: string; selo: string; borda: string }> = {
  neutro: { valor: "text-foreground", selo: "bg-accent text-accent-foreground", borda: "" },
  bom: { valor: "text-sucesso", selo: "bg-sucesso/10 text-sucesso", borda: "" },
  alerta: {
    valor: "text-atencao",
    selo: "bg-atencao/10 text-atencao",
    borda: "border-atencao/40",
  },
  critico: {
    valor: "text-destructive",
    selo: "bg-destructive/10 text-destructive",
    borda: "border-destructive/50",
  },
};

export function Indicador({
  rotulo,
  valor,
  detalhe,
  icone: Icone,
  tom = "neutro",
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  icone?: LucideIcon;
  tom?: Tom;
}) {
  const t = tons[tom];
  return (
    <Card className={cn("transition-shadow hover:shadow-sm", t.borda)}>
      <CardContent className="flex items-start justify-between gap-2 py-1">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{rotulo}</p>
          <p className={cn("font-heading mt-1 text-2xl font-semibold tracking-tight", t.valor)}>
            {valor}
          </p>
          {detalhe && <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>}
        </div>
        {Icone && (
          <span
            aria-hidden
            className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", t.selo)}
          >
            <Icone className="size-4.5" />
          </span>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Frase que lê o número por quem olha.
 *
 * Um painel cheio de porcentagem exige que o leitor saiba o que é bom e o que
 * é ruim. O cliente não sabe — e é para ele que a tela precisa apontar. Por
 * isso cada bloco crítico ganha uma linha em português dizendo o que está
 * acontecendo.
 */
export function Leitura({ tom = "neutro", children }: { tom?: Tom; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        "rounded-lg px-3 py-2 text-xs leading-relaxed",
        tom === "critico" && "bg-destructive/10 text-destructive",
        tom === "alerta" && "bg-atencao/10 text-atencao",
        tom === "bom" && "bg-sucesso/10 text-sucesso",
        tom === "neutro" && "bg-muted text-muted-foreground"
      )}
    >
      {children}
    </p>
  );
}
