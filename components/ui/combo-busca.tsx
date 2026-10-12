"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type OpcaoCombo = { valor: string; rotulo: string; detalhe?: string };

/** Tira acento e caixa: digitar "agua" acha "Água". */
function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Select com busca, para listas que crescem.
 *
 * Um `<select>` nativo com quarenta fornecedores obriga a rolar procurando
 * pelo nome — e no celular vira uma roleta. Aqui o campo é de texto: digita-se
 * parte do nome e a lista filtra.
 *
 * Quando nada casa com o que foi digitado, o componente oferece CADASTRAR
 * aquele texto. Essa é a razão de ele existir e não ser um `<select>` com
 * `datalist`: o momento em que falta um fornecedor é o momento em que se está
 * preenchendo a ordem, e mandar o engenheiro para a tela de cadastro perderia
 * o formulário inteiro.
 *
 * O valor viaja num `<input type="hidden">`, então o formulário em volta
 * continua sendo um formulário comum — nada de estado compartilhado com a
 * página.
 */
export function ComboBusca({
  name,
  opcoes,
  valor,
  aoMudar,
  placeholder = "Buscar...",
  aoCadastrar,
  rotuloCadastrar = "Cadastrar",
  required = false,
  disabled = false,
  id,
}: {
  name: string;
  opcoes: OpcaoCombo[];
  /**
   * Controlado pelo pai, sem estado de seleção aqui dentro.
   *
   * Era estado interno semeado por `valorInicial`, e sincronizar os dois
   * exigia um efeito que chamava `setState` — o que dispara renderização em
   * cascata e o lint acusa com razão. Quem precisa escolher o item
   * recém-criado é o pai; deixar a verdade com ele resolve o caso sem efeito
   * nenhum.
   */
  valor: string;
  aoMudar: (valor: string) => void;
  placeholder?: string;
  /** Sem isto, a opção de cadastrar não aparece. Recebe o texto digitado. */
  aoCadastrar?: (texto: string) => void;
  rotuloCadastrar?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
}) {
  const geradoId = useId();
  const campoId = id ?? geradoId;

  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const [destacado, setDestacado] = useState(0);
  const caixaRef = useRef<HTMLDivElement>(null);

  const escolhida = opcoes.find((o) => o.valor === valor) ?? null;

  const filtradas = useMemo(() => {
    const termo = normalizar(busca);
    if (!termo) return opcoes;
    return opcoes.filter(
      (o) => normalizar(o.rotulo).includes(termo) || normalizar(o.detalhe ?? "").includes(termo)
    );
  }, [opcoes, busca]);

  const podeCadastrar = !!aoCadastrar && busca.trim().length > 0 && filtradas.length === 0;

  // Fecha ao clicar fora. Sem isto, a lista fica aberta por cima do resto do
  // formulário depois que o usuário desiste.
  useEffect(() => {
    if (!aberto) return;
    function aoClicar(e: MouseEvent) {
      if (!caixaRef.current?.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, [aberto]);

  function escolher(novo: string) {
    aoMudar(novo);
    setBusca("");
    setAberto(false);
  }

  function aoTeclar(e: React.KeyboardEvent) {
    if (e.key === "Escape") return setAberto(false);
    if (!aberto && (e.key === "ArrowDown" || e.key === "Enter")) {
      e.preventDefault();
      return setAberto(true);
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setDestacado((i) => Math.min(i + 1, filtradas.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setDestacado((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (podeCadastrar) aoCadastrar?.(busca.trim());
      else if (filtradas[destacado]) escolher(filtradas[destacado].valor);
    }
  }

  return (
    <div ref={caixaRef} className="relative">
      <input type="hidden" name={name} value={valor} required={required} />

      <button
        type="button"
        id={campoId}
        disabled={disabled}
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        className={cn(
          "flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm transition-colors disabled:opacity-60",
          aberto && "ring-2 ring-ring/40"
        )}
      >
        <span className={cn("truncate", !escolhida && "text-muted-foreground")}>
          {escolhida?.rotulo ?? placeholder}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {aberto && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-lg">
          <div className="flex items-center gap-2 border-b px-2.5">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            {/* `autoFocus` aqui é o ponto do componente: abrir e já poder
                digitar é o que o torna mais rápido que o select nativo. */}
            <input
              autoFocus
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setDestacado(0);
              }}
              onKeyDown={aoTeclar}
              placeholder="Digite para filtrar..."
              aria-label="Filtrar opções"
              className="h-9 w-full bg-transparent text-sm outline-none"
            />
          </div>

          <ul role="listbox" className="barra-rolagem max-h-56 overflow-y-auto py-1">
            {filtradas.map((o, i) => (
              <li key={o.valor}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.valor === valor}
                  onMouseEnter={() => setDestacado(i)}
                  onClick={() => escolher(o.valor)}
                  className={cn(
                    "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm",
                    i === destacado && "bg-accent text-accent-foreground"
                  )}
                >
                  <Check
                    className={cn(
                      "size-4 shrink-0",
                      o.valor === valor ? "opacity-100" : "opacity-0"
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{o.rotulo}</span>
                    {o.detalhe && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {o.detalhe}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}

            {!filtradas.length && !podeCadastrar && (
              <li className="px-2.5 py-3 text-center text-sm text-muted-foreground">
                Nada encontrado.
              </li>
            )}
          </ul>

          {podeCadastrar && (
            <button
              type="button"
              onClick={() => {
                aoCadastrar?.(busca.trim());
                setAberto(false);
              }}
              className="flex w-full items-center gap-2 border-t px-2.5 py-2.5 text-left text-sm font-medium text-primary-texto transition-colors hover:bg-accent"
            >
              <Plus className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 truncate">
                {rotuloCadastrar} &ldquo;{busca.trim()}&rdquo;
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
