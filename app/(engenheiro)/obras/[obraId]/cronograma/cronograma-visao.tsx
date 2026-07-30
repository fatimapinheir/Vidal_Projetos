"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { List, GanttChartSquare } from "lucide-react";

/**
 * Alterna entre a tabela (onde se edita) e a timeline (visão geral). As duas são
 * renderizadas no servidor e chegam aqui prontas, como slots.
 */
export function CronogramaVisao({ tabela, timeline }: { tabela: ReactNode; timeline: ReactNode }) {
  const [visao, setVisao] = useState<"tabela" | "timeline">("tabela");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant={visao === "tabela" ? "default" : "outline"}
          onClick={() => setVisao("tabela")}
        >
          <List className="size-4" />
          Tabela
        </Button>
        <Button
          type="button"
          size="sm"
          variant={visao === "timeline" ? "default" : "outline"}
          onClick={() => setVisao("timeline")}
        >
          <GanttChartSquare className="size-4" />
          Timeline
        </Button>
      </div>

      {visao === "tabela" ? tabela : timeline}
    </div>
  );
}
