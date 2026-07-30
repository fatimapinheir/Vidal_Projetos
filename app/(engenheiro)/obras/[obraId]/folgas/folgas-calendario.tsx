"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  format,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { alternarFolgaDia } from "@/app/actions/cronograma";
import { cn } from "@/lib/utils";

type FolgaResumo = { dataInicio: string; dataFim: string };

function paraIsoLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const diasDaSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function FolgasCalendario({ obraId, folgas }: { obraId: string; folgas: FolgaResumo[] }) {
  const [mesAtual, setMesAtual] = useState(() => new Date());
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const inicioGrade = startOfWeek(startOfMonth(mesAtual), { weekStartsOn: 0 });
  const fimGrade = endOfWeek(endOfMonth(mesAtual), { weekStartsOn: 0 });
  const dias = eachDayOfInterval({ start: inicioGrade, end: fimGrade });

  function folgaContendo(dia: Date) {
    const iso = paraIsoLocal(dia);
    return folgas.find((f) => f.dataInicio <= iso && iso <= f.dataFim);
  }

  function handleClickDia(dia: Date) {
    const folga = folgaContendo(dia);
    if (folga && folga.dataInicio !== folga.dataFim) return;
    startTransition(() => {
      alternarFolgaDia(obraId, paraIsoLocal(dia)).then(() => router.refresh());
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => setMesAtual((m) => subMonths(m, 1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <p className="text-sm font-medium capitalize">
          {format(mesAtual, "MMMM 'de' yyyy", { locale: ptBR })}
        </p>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => setMesAtual((m) => addMonths(m, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {diasDaSemana.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {dias.map((dia) => {
          const folga = folgaContendo(dia);
          const isIntervalo = !!folga && folga.dataInicio !== folga.dataFim;
          const foraDoMes = !isSameMonth(dia, mesAtual);
          return (
            <button
              key={dia.toISOString()}
              type="button"
              disabled={pending || isIntervalo}
              onClick={() => handleClickDia(dia)}
              title={isIntervalo ? "Faz parte de um intervalo — remova pela lista abaixo" : undefined}
              className={cn(
                "flex aspect-square items-center justify-center rounded-lg text-sm transition-colors",
                foraDoMes ? "text-muted-foreground/40" : "text-foreground",
                folga
                  ? "bg-destructive/15 font-medium text-destructive"
                  : "hover:bg-muted disabled:hover:bg-transparent",
                isToday(dia) && !folga && "ring-1 ring-inset ring-primary",
                isIntervalo && "cursor-not-allowed opacity-70"
              )}
            >
              {dia.getDate()}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Clique num dia pra marcar ou desmarcar como folga. Dias que fazem parte de um intervalo
        maior (registrado abaixo) só se removem pela lista.
      </p>
    </div>
  );
}
