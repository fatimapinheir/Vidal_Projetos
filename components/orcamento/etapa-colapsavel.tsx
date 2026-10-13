"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useEstadoDasEtapas } from "./controle-etapas";

/**
 * Uma etapa do orçamento que abre e fecha.
 *
 * É cliente, mas as LINHAS não: elas chegam prontas como `children`, montadas
 * no servidor. Isso importa porque a tela do rascunho passa botões de editar e
 * remover por função, e função não atravessa a fronteira servidor/cliente —
 * transformar a lista inteira em componente de cliente quebraria aquela tela.
 * Conteúdo pronto atravessa; função, não.
 *
 * Fechada, a etapa continua dizendo o que interessa de longe: nome, quantos
 * itens e quanto soma. Um orçamento de 438 itens vira 21 linhas legíveis, e
 * quem procura "quanto tem em alvenaria" não rola mais a lista inteira.
 *
 * Abre por padrão; o padrão e o "Recolher todas" vêm do `ControleEtapas`.
 */
export function EtapaColapsavel({
  etapa,
  quantidade,
  subtotal,
  colunas,
  acoes,
  rodape,
  children,
}: {
  etapa: string;
  quantidade: number;
  /** Já formatado: o servidor sabe formatar moeda, o cliente não precisa saber. */
  subtotal: string;
  colunas: number;
  acoes?: ReactNode;
  rodape?: ReactNode;
  children: ReactNode;
}) {
  const { padrao, versao } = useEstadoDasEtapas();

  /*
   * Estado local que cede ao comando geral.
   *
   * Guarda junto a versão em que a escolha foi feita: se o usuário mandou
   * recolher tudo depois disso, a versão não bate mais e vale o padrão novo.
   * Derivar em vez de sincronizar por efeito evita o quadro piscando aberto
   * antes de fechar.
   */
  const [local, setLocal] = useState({ versao, aberta: padrao });
  const aberta = local.versao === versao ? local.aberta : padrao;
  const setAberta = (proxima: (atual: boolean) => boolean) =>
    setLocal({ versao, aberta: proxima(aberta) });

  return (
    <>
      <TableRow className="bg-muted/40 hover:bg-muted/40">
        <TableCell colSpan={colunas - 1} className="font-medium">
          <span className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAberta((atual) => !atual)}
              aria-expanded={aberta}
              className="flex items-center gap-1.5 rounded text-left hover:text-primary-texto"
            >
              <ChevronRight
                className={cn("size-4 shrink-0 transition-transform", aberta && "rotate-90")}
                aria-hidden
              />
              {etapa}
              <span className="text-xs font-normal text-muted-foreground">
                {quantidade} {quantidade === 1 ? "item" : "itens"}
              </span>
            </button>
            {acoes}
          </span>
        </TableCell>
        <TableCell className="text-right font-medium tabular-nums">{subtotal}</TableCell>
      </TableRow>

      {aberta && children}
      {aberta && rodape}
    </>
  );
}
