"use client";

import { useState, type ReactNode } from "react";
import { Eye, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Alterna entre a tela que o cliente vê e o painel do engenheiro.
 *
 * Abre na do cliente, de propósito. O engenheiro mexe na obra todo dia —
 * muda status, lança avanço, fecha um RDO — e não tinha como conferir o
 * resultado sem a senha do cliente; a dúvida "o que ele está vendo agora?"
 * só se respondia pedindo o login dele. Com a prévia como padrão, abrir a
 * obra já responde.
 *
 * Os dois painéis chegam montados do servidor e ficam os dois no documento:
 * trocar a visão é instantâneo e não refaz consulta nenhuma. É o que permite
 * conferir uma alteração e voltar ao painel sem perder o lugar.
 */
export function SeletorDeVisao({
  doCliente,
  doEngenheiro,
}: {
  doCliente: ReactNode;
  doEngenheiro: ReactNode;
}) {
  const [visao, setVisao] = useState<"cliente" | "engenheiro">("cliente");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {visao === "cliente"
            ? "Esta é a tela inicial como o cliente a vê agora."
            : "Painel de acompanhamento da obra."}
        </p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant={visao === "cliente" ? "default" : "outline"}
            onClick={() => setVisao("cliente")}
          >
            <Eye className="size-4" aria-hidden /> Visão do cliente
          </Button>
          <Button
            type="button"
            size="sm"
            variant={visao === "engenheiro" ? "default" : "outline"}
            onClick={() => setVisao("engenheiro")}
          >
            <Gauge className="size-4" aria-hidden /> Painel do engenheiro
          </Button>
        </div>
      </div>

      {/*
        `hidden` em vez de desmontar: a visão do cliente tem rolagem
        horizontal na trilha de etapas e um gráfico que se mede ao montar.
        Desmontando, cada ida e volta reiniciava os dois.
      */}
      <div hidden={visao !== "cliente"}>{doCliente}</div>
      <div hidden={visao !== "engenheiro"}>{doEngenheiro}</div>
    </div>
  );
}
