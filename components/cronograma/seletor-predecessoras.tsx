"use client";

import { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type TarefaOpcao = { id: string; nome: string; etapa: string };

function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Escolha de várias predecessoras, com busca.
 *
 * Era um `<select>` de uma predecessora só, limitado às tarefas da mesma
 * etapa. As duas limitações descreviam uma obra que não existe: "conferência
 * e concretagem do baldrame" espera as formas, as armaduras E as passagens
 * hidráulicas, e "marcação das paredes" espera o contrapiso da etapa 2 e a
 * retirada do escoramento da etapa 3.
 *
 * Lista de busca em vez de caixas de seleção porque um cronograma real tem
 * 152 tarefas — rolar 152 checkboxes para marcar três é pior que digitar
 * "baldrame".
 *
 * Cada escolha vira um `<input type="hidden">` com o mesmo `name`, então a
 * ação lê tudo com `formData.getAll` e o formulário em volta continua sendo
 * um formulário comum.
 */
export function SeletorPredecessoras({
  name,
  tarefas,
  selecionadas,
  aoMudar,
}: {
  name: string;
  tarefas: TarefaOpcao[];
  selecionadas: string[];
  aoMudar: (ids: string[]) => void;
}) {
  const [busca, setBusca] = useState("");

  const porId = useMemo(() => new Map(tarefas.map((t) => [t.id, t])), [tarefas]);

  const filtradas = useMemo(() => {
    const termo = normalizar(busca);
    if (!termo) return tarefas.slice(0, 40);
    return tarefas
      .filter((t) => normalizar(t.nome).includes(termo) || normalizar(t.etapa).includes(termo))
      .slice(0, 40);
  }, [tarefas, busca]);

  function alternar(id: string) {
    aoMudar(
      selecionadas.includes(id)
        ? selecionadas.filter((x) => x !== id)
        : [...selecionadas, id]
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {selecionadas.map((id) => (
        <input key={id} type="hidden" name={name} value={id} readOnly />
      ))}

      {!!selecionadas.length && (
        <ul className="flex flex-wrap gap-1.5">
          {selecionadas.map((id) => {
            const t = porId.get(id);
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => alternar(id)}
                  className="flex max-w-full items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground transition-colors hover:bg-accent/70"
                >
                  <span className="min-w-0 truncate">{t?.nome ?? "Tarefa removida"}</span>
                  <X className="size-3 shrink-0" aria-hidden />
                  <span className="sr-only">Remover</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="rounded-lg border">
        <div className="flex items-center gap-2 border-b px-2.5">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar tarefa..."
            aria-label="Buscar tarefa predecessora"
            className="h-9 w-full bg-transparent text-sm outline-none"
          />
        </div>

        <ul className="barra-rolagem max-h-48 overflow-y-auto py-1">
          {filtradas.map((t) => {
            const marcada = selecionadas.includes(t.id);
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => alternar(t.id)}
                  className={cn(
                    "flex w-full items-start gap-2 px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                    marcada && "bg-accent/50"
                  )}
                >
                  <Check
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      marcada ? "opacity-100 text-primary-texto" : "opacity-0"
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block truncate">{t.nome}</span>
                    <span className="block truncate text-xs text-muted-foreground">{t.etapa}</span>
                  </span>
                </button>
              </li>
            );
          })}

          {!filtradas.length && (
            <li className="px-2.5 py-3 text-center text-sm text-muted-foreground">
              Nenhuma tarefa encontrada.
            </li>
          )}
        </ul>

        {/* Sem busca a lista mostra só as primeiras — 152 itens de uma vez
            tornam a rolagem inútil e a escolha mais lenta que digitar. */}
        {!busca && tarefas.length > 40 && (
          <p className="border-t px-2.5 py-1.5 text-xs text-muted-foreground">
            Mostrando 40 de {tarefas.length}. Digite para filtrar.
          </p>
        )}
      </div>
    </div>
  );
}
