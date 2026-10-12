"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavEntry, NavItem } from "./app-shell";
import { navIcones, type NomeDeIcone } from "./nav-icones";
import { obraDoCaminho, resolverHref } from "./nav-href";

function ehGrupo(
  entrada: NavEntry
): entrada is { label: string; items: NavItem[]; icone?: NomeDeIcone } {
  return "items" in entrada;
}

function ehSecao(entrada: NavEntry): entrada is { secao: string } {
  return "secao" in entrada;
}

function cobre(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Qual href do menu representa a tela atual — vence o mais longo que a cobre.
 *
 * Comparar cada item isoladamente não funciona desde que as seções da obra
 * foram para a lateral: /obras/<id>/diario é coberto tanto por "Diário"
 * (/obras/<id>/diario) quanto por "Obras" (/obras), e os dois acendiam juntos.
 *
 * O mais longo é sempre o mais específico, e isso resolve os três casos de uma
 * vez: dentro da obra ganha a seção; em /obras/novo só "Obras" cobre, e ela
 * ganha; em /obras/<id> a visão geral ganha de "Obras" sem precisar marcar
 * nada à mão.
 */
function acharAtivo(pathname: string, hrefs: string[]): string | undefined {
  return hrefs.filter((h) => cobre(pathname, h)).sort((a, b) => b.length - a.length)[0];
}

function ItemLink({
  item,
  href,
  ativo,
  onNavegar,
}: {
  item: NavItem;
  href: string;
  ativo: boolean;
  onNavegar?: () => void;
}) {
  const Icone = item.icone ? navIcones[item.icone] : undefined;
  return (
    <Link
      href={href}
      onClick={onNavegar}
      aria-current={ativo ? "page" : undefined}
      className={cn(
        // min-h-11 ≈ 44px: alvo de toque confortável no celular.
        "relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors md:min-h-10",
        ativo
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-suave hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
      )}
    >
      {/*
        A marcação do item ativo é a barra âmbar, não o fundo.
        
        O fundo mais claro sozinho é fraco demais sobre o navy — a diferença
        entre item ativo e item sob o cursor some. A barra resolve porque é a
        única coisa âmbar da coluna, e âmbar aqui só quer dizer uma coisa:
        você está nesta tela. Fica colada na borda esquerda da lateral
        (`-left-3` cancela o padding da <nav>), que é de onde ela aponta.
      */}
      {ativo && (
        <span
          aria-hidden
          className="absolute top-1/2 -left-3 h-6 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-primary"
        />
      )}
      {Icone && (
        <Icone
          className={cn("size-[18px] shrink-0", ativo ? "text-sidebar-primary" : "opacity-80")}
          aria-hidden
        />
      )}
      {/* Sem `truncate`: em item de menu duas linhas lêem melhor que reticências,
          que cortariam justamente a palavra que diferencia a tela. */}
      <span className="leading-tight">{item.label}</span>
    </Link>
  );
}

/**
 * Navegação compartilhada pela sidebar (desktop) e pela gaveta (celular).
 *
 * As telas do dia a dia ficam soltas, uma linha cada: encaixotá-las num cartão
 * que abre e fecha esconderia atrás de um clique justamente o que mais se usa.
 * Rótulo de seção separa as áreas sem custar nada — é texto, não botão.
 *
 * Sobra o cartão para Cadastros, que é o caso inverso: muita tela, pouco uso,
 * e vale poder recolher. Quando aberto, ele empurra o que vem abaixo em vez de
 * cobrir — nada do menu some de vista.
 */
export function NavEntries({
  entradas,
  obraLembrada = null,
  onNavegar,
}: {
  entradas: NavEntry[];
  obraLembrada?: string | null;
  onNavegar?: () => void;
}) {
  const pathname = usePathname();
  const obraEmFoco = obraDoCaminho(pathname) ?? obraLembrada;

  const href = (item: NavItem) => resolverHref(item, obraEmFoco);
  const todosHrefs = entradas.flatMap((e) =>
    ehGrupo(e) ? e.items.map(href) : ehSecao(e) ? [] : [href(e)]
  );
  const hrefAtivo = acharAtivo(pathname, todosHrefs);

  return (
    <>
      {entradas.map((entrada) =>
        ehSecao(entrada) ? (
          <p
            key={`secao-${entrada.secao}`}
            className="mt-5 px-3 pb-1 text-[11px] font-semibold tracking-[0.1em] text-sidebar-suave/80 uppercase first:mt-0"
          >
            {entrada.secao}
          </p>
        ) : ehGrupo(entrada) ? (
          <Grupo
            key={entrada.label}
            label={entrada.label}
            items={entrada.items}
            icone={entrada.icone}
            hrefAtivo={hrefAtivo}
            resolver={href}
            onNavegar={onNavegar}
          />
        ) : (
          <ItemLink
            key={entrada.label}
            item={entrada}
            href={href(entrada)}
            ativo={href(entrada) === hrefAtivo}
            onNavegar={onNavegar}
          />
        )
      )}
    </>
  );
}

function Grupo({
  label,
  items,
  icone,
  hrefAtivo,
  resolver,
  onNavegar,
}: {
  label: string;
  items: NavItem[];
  icone?: NomeDeIcone;
  hrefAtivo?: string;
  resolver: (item: NavItem) => string;
  onNavegar?: () => void;
}) {
  const Icone = icone ? navIcones[icone] : undefined;
  const algumAtivo = items.some((i) => resolver(i) === hrefAtivo);
  // Nasce fechado: é o bloco de manutenção, não o de uso diário. Com uma tela
  // dele ativa, abre — senão você não veria onde está.
  const [aberto, setAberto] = useState(algumAtivo);
  const painelId = useId();

  return (
    <div
      className={cn(
        "mt-2 rounded-xl border transition-colors",
        // Com uma tela ativa dentro, o cartão se acende de leve. É o que mantém
        // a referência de "onde estou" mesmo com o grupo fechado.
        algumAtivo
          ? "border-sidebar-primary/30 bg-sidebar-accent/70"
          : "border-sidebar-border bg-white/[0.03]"
      )}
    >
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-controls={painelId}
        className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60"
      >
        {Icone && <Icone className="size-[18px] shrink-0 opacity-80" aria-hidden />}
        <span className="flex-1 truncate text-left">{label}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-sidebar-suave transition-transform duration-200",
            !aberto && "-rotate-90"
          )}
          aria-hidden
        />
      </button>

      {/* Anima a altura por grid-template-rows: 0fr→1fr é a única forma de ir
          de zero até "a altura que o conteúdo tiver" sem medir nada em JS.
          `inert` tira os links fechados do Tab — sem ele o teclado entraria num
          menu invisível, já que o conteúdo continua no DOM para poder animar. */}
      <div
        id={painelId}
        inert={!aberto}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          aberto ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-0.5 px-1.5 pb-1.5">
            {items.map((item) => (
              <ItemLink
                key={item.label}
                item={item}
                href={resolver(item)}
                ativo={resolver(item) === hrefAtivo}
                onNavegar={onNavegar}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
