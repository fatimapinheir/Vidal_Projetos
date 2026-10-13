"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * O padrão de abertura das etapas do orçamento, e um botão que o inverte.
 *
 * O orçamento abre inteiro. Já foi o contrário — listas acima de cinquenta
 * itens nasciam recolhidas, para que as faixas de etapa servissem de índice —,
 * e o efeito prático foi outro: quem abria o orçamento via uma tela de títulos
 * e tinha de clicar etapa por etapa para ler o que havia contratado. O índice
 * resolvia um problema de rolagem e criava um de leitura.
 *
 * Agora quem decide é o usuário, numa tecla só: "Recolher todas" transforma a
 * lista no índice quando é isso que ele quer, e o estado vale para a tela
 * inteira em vez de etapa por etapa.
 *
 * O contexto carrega `versao` junto do padrão porque cada etapa também pode
 * ser aberta ou fechada individualmente. Sem a versão, uma etapa que o usuário
 * fechou à mão ignoraria o "Expandir todas" seguinte — o estado local dela
 * venceria para sempre. A versão diz "esta é uma ordem nova", e aí o local
 * cede.
 */
type EstadoEtapas = { padrao: boolean; versao: number };

const ContextoEtapas = createContext<EstadoEtapas>({ padrao: true, versao: 0 });

export function useEstadoDasEtapas() {
  return useContext(ContextoEtapas);
}

export function ControleEtapas({
  children,
  quantidadeDeEtapas,
}: {
  children: ReactNode;
  /** Com uma etapa só não há o que recolher em massa — o botão não aparece. */
  quantidadeDeEtapas: number;
}) {
  const [estado, setEstado] = useState<EstadoEtapas>({ padrao: true, versao: 0 });

  return (
    <ContextoEtapas.Provider value={estado}>
      <div className="flex flex-col gap-2">
        {quantidadeDeEtapas > 1 && (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setEstado((atual) => ({ padrao: !atual.padrao, versao: atual.versao + 1 }))
              }
            >
              {estado.padrao ? (
                <>
                  <ChevronsDownUp className="size-4" aria-hidden /> Recolher todas
                </>
              ) : (
                <>
                  <ChevronsUpDown className="size-4" aria-hidden /> Expandir todas
                </>
              )}
            </Button>
          </div>
        )}
        {children}
      </div>
    </ContextoEtapas.Provider>
  );
}
