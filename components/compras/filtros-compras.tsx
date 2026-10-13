"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListFilter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TipoItemOrcamento } from "@/lib/types/database.types";

export type TipoFiltro = TipoItemOrcamento | "todos";

const TIPOS: { valor: TipoFiltro; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "material", rotulo: "Material" },
  { valor: "servico", rotulo: "Serviço" },
  { valor: "mao_de_obra", rotulo: "Mão de obra" },
];

/**
 * Busca e filtro de tipo da lista de ordens de compra do engenheiro.
 *
 * Os mesmos filtros do portal do cliente, pela mesma razão: a lista é paginada
 * de 25 em 25, e numa obra com duzentas ordens achar "aquela compra de ferro"
 * significava virar página atrás de página.
 *
 * Os filtros moram na URL, não em estado de componente. Filtrar no cliente só
 * enxergaria a página carregada: procurar um fornecedor acharia nada se ele
 * estivesse na página 3, e a tela responderia "não existe" para algo que
 * existe. Com o filtro na URL quem procura é o banco, sobre a obra inteira — e
 * de quebra o link é compartilhável e o voltar do navegador funciona.
 */
export function FiltrosCompras({
  base,
  busca,
  tipo,
  resultados,
}: {
  /** Caminho da lista, sem query. */
  base: string;
  busca: string;
  tipo: TipoFiltro;
  /** Quantas linhas o filtro encontrou na obra inteira. */
  resultados: number;
}) {
  const router = useRouter();
  const [termo, setTermo] = useState(busca);
  const [abertos, setAbertos] = useState(tipo !== "todos");
  const [, iniciar] = useTransition();
  const atrasoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function irPara(mudancas: { busca?: string; tipo?: TipoFiltro }) {
    const atual = { busca: termo, tipo, ...mudancas };
    const query = new URLSearchParams();
    if (atual.busca?.trim()) query.set("busca", atual.busca.trim());
    if (atual.tipo !== "todos") query.set("tipo", atual.tipo);
    // Qualquer filtro novo volta para a página 1: continuar na 7 depois de
    // reduzir o resultado a dez linhas mostraria uma tela vazia.
    const texto = query.toString();
    iniciar(() => router.replace(texto ? `${base}?${texto}` : base));
  }

  /*
   * A busca espera meio segundo antes de ir ao servidor.
   *
   * Sem isso, cada tecla seria uma consulta e uma renderização — a lista
   * piscaria a cada letra. O texto digitado fica em estado local para o campo
   * continuar respondendo na hora; quem demora é só a ida ao banco.
   */
  function aoBuscar(valor: string) {
    setTermo(valor);
    if (atrasoRef.current) clearTimeout(atrasoRef.current);
    atrasoRef.current = setTimeout(() => irPara({ busca: valor }), 500);
  }

  const filtrando = !!busca || tipo !== "todos";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-72">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={termo}
            onChange={(e) => aoBuscar(e.target.value)}
            placeholder="Buscar por descrição ou fornecedor..."
            aria-label="Buscar ordens de compra"
            className="h-9 w-full pl-8"
          />
        </div>
        <Button
          type="button"
          variant={tipo === "todos" ? "outline" : "default"}
          size="sm"
          className="h-9"
          aria-expanded={abertos}
          onClick={() => setAbertos((v) => !v)}
        >
          <ListFilter className="size-4" />
          Filtros
        </Button>
        {filtrando && (
          <span className="text-xs text-muted-foreground">
            {resultados} {resultados === 1 ? "resultado" : "resultados"}
            <button
              type="button"
              onClick={() => {
                setTermo("");
                irPara({ busca: "", tipo: "todos" });
              }}
              className="ml-2 underline underline-offset-4 hover:text-foreground"
            >
              limpar
            </button>
          </span>
        )}
      </div>

      {abertos && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">Tipo:</span>
          {TIPOS.map((t) => (
            <Button
              key={t.valor}
              type="button"
              size="sm"
              variant={tipo === t.valor ? "default" : "outline"}
              className="h-7"
              onClick={() => irPara({ tipo: t.valor })}
            >
              {t.rotulo}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
