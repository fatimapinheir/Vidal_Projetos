import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { cn } from "@/lib/utils";

function Barra({
  label,
  value,
  indicatorClassName,
}: {
  label: string;
  value: number;
  indicatorClassName?: string;
}) {
  const clamped = Math.min(Math.max(value, 0), 100);
  return (
    <ProgressPrimitive.Root value={clamped} className="flex flex-col gap-1.5">
      <div className="flex w-full justify-between text-sm">
        <ProgressPrimitive.Label className="font-medium">{label}</ProgressPrimitive.Label>
        <ProgressPrimitive.Value className="text-muted-foreground tabular-nums" />
      </div>
      <ProgressPrimitive.Track className="relative flex h-2.5 w-full items-center overflow-x-hidden rounded-full bg-grafico-trilho">
        <ProgressPrimitive.Indicator
          className={cn("h-full rounded-full bg-grafico-pago transition-all", indicatorClassName)}
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  );
}

export function ProgressoOrcamento({
  percentualFisico,
  percentualFinanceiro,
}: {
  percentualFisico: number;
  percentualFinanceiro: number;
}) {
  const gastoAcimaDoFisico = percentualFinanceiro > percentualFisico + 10;

  return (
    <div className="flex flex-col gap-3">
      <Barra label="Físico executado" value={percentualFisico} />
      <Barra
        label="Financeiro gasto"
        value={percentualFinanceiro}
        indicatorClassName={gastoAcimaDoFisico ? "bg-grafico-vencido" : undefined}
      />
    </div>
  );
}
