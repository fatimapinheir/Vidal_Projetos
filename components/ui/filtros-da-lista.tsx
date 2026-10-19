"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListFilter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Um campo do painel de filtros. Declarativo para que toda tela desenhe igual. */
export type CampoFiltro =
  | { chave: string; rotulo: string; tipo: "data" | "numero" | "texto"; dica?: string }
  | { chave: string; rotulo: string; tipo: "opcoes"; opcoes: { valor: string; rotulo: string }[] };

export type OpcaoOrdem = { valor: string; rotulo: string };

const CLASSE_SELECT =
  "h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm disabled:opacity-60";

/**
 * A barra de filtros de qualquer listagem do sistema.
 *
 * Existe para que as telas se pareçam. Antes cada listagem resolvia à sua
 * maneira: as compras tinham busca e chips, o portal tinha busca com abas, o
 * SINAPI tinha um componente próprio, e o resto não tinha nada. Quem aprendia
 * a filtrar numa tela não sabia filtrar na seguinte.
 *
 * Os filtros vivem na URL, e não em estado de componente. Filtrar no navegador
 * só enxerga a página carregada: procurar um fornecedor que está na página 3
 * responderia "não existe" para algo que existe. Com o filtro na URL quem
 * procura é o banco, sobre a lista inteira — e de quebra o link é
 * compartilhável e o voltar do navegador funciona.
 *
 * Os campos são DECLARADOS, não desenhados pela tela. É o que garante que o
 * painel de filtros da ordem de compra e o do fornecedor tenham o mesmo
 * espaçamento, a mesma altura e o mesmo comportamento sem ninguém combinar.
 */
export function FiltrosDaLista({
  base,
  busca,
  placeholder,
  ordem,
  ordens,
  campos = [],
  valores = {},
  resultados,
  soma,
}: {
  /** Caminho da lista, sem query. */
  base: string;
  busca: string;
  placeholder: string;
  /** Ordenação corrente. */
  ordem?: string;
  /** Vazio esconde o seletor — nem toda lista tem o que ordenar. */
  ordens?: OpcaoOrdem[];
  campos?: CampoFiltro[];
  /** Valor corrente de cada campo, pela chave. */
  valores?: Record<string, string>;
  /** Quantas linhas o filtro encontrou na lista inteira. */
  resultados: number;
  /** Soma dos resultados, já formatada. Ausente, não aparece. */
  soma?: string;
}) {
  const router = useRouter();
  const [termo, setTermo] = useState(busca);
  const temFiltroAtivo = campos.some((c) => !!valores[c.chave]);
  const [abertos, setAbertos] = useState(temFiltroAtivo);
  const [, iniciar] = useTransition();
  const atrasoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function irPara(mudancas: Record<string, string | undefined>) {
    const atual: Record<string, string | undefined> = {
      busca: termo,
      ordem,
      ...valores,
      ...mudancas,
    };
    const query = new URLSearchParams();
    for (const [chave, valor] of Object.entries(atual)) {
      if (valor && valor.trim()) query.set(chave, valor.trim());
    }
    // Filtro novo volta para a página 1: continuar na 7 depois de reduzir o
    // resultado a dez linhas mostraria uma tela vazia.
    query.delete("pagina");
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

  function limpar() {
    setTermo("");
    const zerados = Object.fromEntries(campos.map((c) => [c.chave, undefined]));
    irPara({ busca: "", ...zerados });
  }

  const filtrando = !!busca || temFiltroAtivo;

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
            placeholder={placeholder}
            aria-label={placeholder}
            className="h-9 w-full pl-8"
          />
        </div>

        {!!campos.length && (
          <Button
            type="button"
            variant={temFiltroAtivo ? "default" : "outline"}
            size="sm"
            className="h-9"
            aria-expanded={abertos}
            onClick={() => setAbertos((v) => !v)}
          >
            <ListFilter className="size-4" />
            Filtros
          </Button>
        )}

        {!!ordens?.length && (
          <select
            value={ordem ?? ordens[0].valor}
            onChange={(e) => irPara({ ordem: e.target.value })}
            aria-label="Ordenar a lista"
            className={CLASSE_SELECT}
          >
            {ordens.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </select>
        )}

        {filtrando && (
          <span className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
            <span>
              {resultados} {resultados === 1 ? "resultado" : "resultados"}
            </span>
            {soma && (
              <span className="font-semibold text-foreground tabular-nums">{soma}</span>
            )}
            <button
              type="button"
              onClick={limpar}
              className="underline underline-offset-4 hover:text-foreground"
            >
              limpar
            </button>
          </span>
        )}
      </div>

      {abertos && !!campos.length && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
          {campos.map((campo) =>
            campo.tipo === "opcoes" ? (
              <div key={campo.chave} className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">{campo.rotulo}</label>
                <select
                  value={valores[campo.chave] ?? ""}
                  onChange={(e) => irPara({ [campo.chave]: e.target.value })}
                  className={CLASSE_SELECT}
                >
                  <option value="">Todas</option>
                  {campo.opcoes.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.rotulo}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div key={campo.chave} className="flex flex-col gap-1">
                <label
                  htmlFor={`filtro-${campo.chave}`}
                  className="text-xs font-medium text-muted-foreground"
                >
                  {campo.rotulo}
                </label>
                <Input
                  id={`filtro-${campo.chave}`}
                  type={campo.tipo === "data" ? "date" : campo.tipo === "numero" ? "number" : "text"}
                  inputMode={campo.tipo === "numero" ? "decimal" : undefined}
                  step={campo.tipo === "numero" ? "0.01" : undefined}
                  min={campo.tipo === "numero" ? "0" : undefined}
                  /*
                    Não controlado, e salva ao SAIR do campo. Controlado com ida
                    à URL a cada tecla faria a lista recarregar enquanto se
                    digita uma data — e uma data meio digitada é sempre um
                    filtro absurdo, que esvazia a tela no meio da digitação.
                  */
                  defaultValue={valores[campo.chave] ?? ""}
                  onBlur={(e) => {
                    if ((e.target.value || "") !== (valores[campo.chave] ?? "")) {
                      irPara({ [campo.chave]: e.target.value });
                    }
                  }}
                  placeholder={campo.dica}
                  className="h-9 w-40"
                />
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
