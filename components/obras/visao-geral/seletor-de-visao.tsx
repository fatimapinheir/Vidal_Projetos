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
 * O painel do engenheiro só é MONTADO no primeiro clique, e dali em diante
 * fica. Montar os dois de saída dobrava o tamanho da página para entregar um
 * painel que a maior parte das visitas nunca abre — e esta é a tela mais
 * pesada do sistema. Depois do primeiro clique os dois convivem no documento,
 * e trocar a visão volta a ser instantâneo, sem refazer consulta nenhuma: é o
 * que permite conferir uma alteração e voltar sem perder o lugar.
 *
 * Os dados dos dois painéis são os mesmos e já vieram na requisição, então
 * montar depois não custa ida ao servidor — custa só o trabalho de desenhar.
 */
export function SeletorDeVisao({
  doCliente,
  doEngenheiro,
}: {
  doCliente: ReactNode;
  doEngenheiro: ReactNode;
}) {
  const [visao, setVisao] = useState<"cliente" | "engenheiro">("cliente");
  /*
   * Estado, e não `ref`: o painel precisa APARECER no mesmo instante em que
   * vira `true`, e ler um ref durante a renderização não garante isso — o
   * React não re-renderiza por causa dele.
   */
  const [engenheiroMontado, setEngenheiroMontado] = useState(false);

  function mostrar(qual: "cliente" | "engenheiro") {
    if (qual === "engenheiro") setEngenheiroMontado(true);
    setVisao(qual);
  }

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
            onClick={() => mostrar("cliente")}
          >
            <Eye className="size-4" aria-hidden /> Visão do cliente
          </Button>
          <Button
            type="button"
            size="sm"
            variant={visao === "engenheiro" ? "default" : "outline"}
            onClick={() => mostrar("engenheiro")}
          >
            <Gauge className="size-4" aria-hidden /> Painel do engenheiro
          </Button>
        </div>
      </div>

      {/*
        `hidden` em vez de desmontar, uma vez que o painel exista: a visão do
        cliente tem rolagem horizontal na trilha de etapas e um gráfico que se
        mede ao montar. Desmontando, cada ida e volta reiniciava os dois.
      */}
      <div hidden={visao !== "cliente"}>{doCliente}</div>
      {engenheiroMontado && (
        <div hidden={visao !== "engenheiro"}>{doEngenheiro}</div>
      )}
    </div>
  );
}
