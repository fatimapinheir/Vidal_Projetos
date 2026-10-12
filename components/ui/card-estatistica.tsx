import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Cartão de número-manchete: rótulo, valor grande e um selo de ícone.
 *
 * O ícone é decorativo (`aria-hidden`) — ele ajuda a varrer a fileira de
 * cartões com o olho, mas quem lê por leitor de tela já tem o rótulo em texto,
 * e anunciar "ícone de capacete" depois de "obras ativas" só atrapalha.
 *
 * `tom` codifica estado, não enfeite: `destaque` para dinheiro e contagem
 * normal, `alerta` para o que exige ação (parcela vencida). Por isso são dois,
 * e não uma cor por cartão — cor demais e nenhuma chama atenção.
 */
export function CardEstatistica({
  rotulo,
  valor,
  descricao,
  Icone,
  tom = "neutro",
  className,
}: {
  rotulo: string;
  valor: string | number;
  descricao?: string;
  Icone?: LucideIcon;
  tom?: "neutro" | "destaque" | "alerta";
  className?: string;
}) {
  const tomDoValor =
    tom === "alerta" ? "text-destructive" : tom === "destaque" ? "text-primary-texto" : "text-foreground";
  const tomDoSelo =
    tom === "alerta"
      ? "bg-destructive/10 text-destructive"
      : "bg-accent text-accent-foreground";

  return (
    <Card className={cn("transition-shadow hover:shadow-sm", className)}>
      <CardContent className="flex items-start justify-between gap-3 py-1">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{rotulo}</p>
          <p className={cn("font-heading mt-1 text-2xl font-semibold tracking-tight", tomDoValor)}>
            {valor}
          </p>
          {descricao && <p className="mt-1 text-xs text-muted-foreground">{descricao}</p>}
        </div>
        {Icone && (
          <span
            aria-hidden
            className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", tomDoSelo)}
          >
            <Icone className="size-4.5" />
          </span>
        )}
      </CardContent>
    </Card>
  );
}
