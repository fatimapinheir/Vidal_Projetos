"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { formatDateBR } from "@/lib/format-date";
import type { NavEntry, NavItem } from "./app-shell";
import { obraDoCaminho, resolverHref } from "./nav-href";

type Achatado = { item: NavItem; grupo?: string };

function achatar(entradas: NavEntry[]): Achatado[] {
  return entradas.flatMap<Achatado>((e) => {
    if ("items" in e) return e.items.map((item) => ({ item, grupo: e.label }));
    // Rótulo de seção não é destino: não entra na trilha.
    if ("secao" in e) return [];
    return [{ item: e }];
  });
}

/**
 * Telas que ficam abaixo de um item do menu e por isso não têm entrada própria
 * nele — o formulário de nova compra, o detalhe de uma parcela, um dia do
 * diário.
 *
 * Casam contra o caminho inteiro, e não só contra o que sobra depois do item,
 * porque o mesmo sufixo quer dizer coisas diferentes em lugares diferentes:
 * "novo" é "Nova obra" sob /obras e "Nova ordem de compra" sob /compras.
 *
 * A ORDEM importa: /compras/novo precisa ser testado antes de /compras/<id>,
 * senão "novo" seria lido como o id de uma compra.
 */
const SUBROTAS: { padrao: RegExp; rotulo: string | ((m: RegExpMatchArray) => string) }[] = [
  { padrao: /^\/obras\/novo$/, rotulo: "Nova obra" },
  { padrao: /^\/obras\/[^/]+\/compras\/novo$/, rotulo: "Nova ordem de compra" },
  { padrao: /^\/obras\/[^/]+\/compras\/[^/]+$/, rotulo: "Detalhe da ordem" },
  { padrao: /^\/obras\/[^/]+\/diario\/([^/]+)$/, rotulo: (m) => formatDateBR(m[1]) },
  { padrao: /^\/obras\/[^/]+\/orcamento\/upload$/, rotulo: "Importar planilha" },
  { padrao: /^\/sinapi\/upload$/, rotulo: "Importar tabela" },
  { padrao: /^\/portal\/obras\/[^/]+\/compras\/[^/]+$/, rotulo: "Detalhe da ordem" },
  { padrao: /^\/portal\/obras\/[^/]+\/diario\/([^/]+)$/, rotulo: (m) => formatDateBR(m[1]) },
];

/** Último recurso: vira "importar-nota" em "Importar nota". */
function humanizar(segmento: string) {
  const texto = segmento.replace(/-/g, " ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function rotuloDaSubrota(pathname: string, restante: string): string {
  for (const { padrao, rotulo } of SUBROTAS) {
    const m = pathname.match(padrao);
    if (m) return typeof rotulo === "function" ? rotulo(m) : rotulo;
  }
  return humanizar(restante.split("/").pop() ?? "");
}

type Degrau = { rotulo: string; href?: string };

function Separador() {
  return <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />;
}

/**
 * Trilha da tela atual, no cabeçalho do desktop.
 *
 * É trilha e não título: a página já tem o seu `h1`, e repetir a mesma frase
 * em destaque duas vezes na mesma dobra faria o cabeçalho parecer um erro.
 * Como trilha, a repetição é o comportamento esperado, e o que ela acrescenta
 * é de onde a tela veio e o caminho de volta.
 *
 * Os degraus anteriores saem da própria navegação em vez de cada página passar
 * o seu rótulo: duas fontes para o mesmo nome divergem na primeira vez que
 * alguém renomeia um item do menu e esquece do cabeçalho.
 */
export function Trilha({
  entradas,
  obraLembrada = null,
}: {
  entradas: NavEntry[];
  obraLembrada?: string | null;
}) {
  const pathname = usePathname();
  const obraEmFoco = obraDoCaminho(pathname) ?? obraLembrada;

  // Mesma resolução de href e mesma regra do "mais longo vence" do menu — se
  // as duas divergirem, a trilha aponta para uma tela e o menu acende outra.
  const melhor = achatar(entradas)
    .map((a) => ({ ...a, href: resolverHref(a.item, obraEmFoco) }))
    .filter(({ href }) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];

  if (!melhor) return <span className="text-sm font-semibold">Ankora</span>;

  const restante = pathname.slice(melhor.href.length).replace(/^\//, "");

  const degraus: Degrau[] = [
    // O grupo é só um cartão que abre e fecha, não tem tela própria: entra
    // como contexto, sem link.
    ...(melhor.grupo ? [{ rotulo: melhor.grupo }] : []),
    // O item vira link só quando não é a tela atual — "voltar para onde você
    // já está" é um clique que não faz nada.
    { rotulo: melhor.item.label, href: restante ? melhor.href : undefined },
    ...(restante ? [{ rotulo: rotuloDaSubrota(pathname, restante) }] : []),
  ];

  return (
    <nav aria-label="Trilha de navegação">
      {/* Caixa-alta por CSS, não no texto: o rótulo no DOM continua "Ordens de
          Compra", que é como o leitor de tela anuncia. Texto gravado em
          maiúsculas seria lido letra por letra, como sigla.

          O `tracking-wide` acompanha: maiúscula sem respiro entre letras
          fecha a palavra e custa legibilidade justo no tamanho pequeno. */}
      <ol className="flex flex-wrap items-center gap-1 text-sm font-semibold tracking-wide uppercase">
        {degraus.map((degrau, i) => {
          const ultimo = i === degraus.length - 1;
          return (
            <li key={`${degrau.rotulo}-${i}`} className="flex items-center gap-1">
              {i > 0 && <Separador />}
              {degrau.href ? (
                <Link
                  href={degrau.href}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {degrau.rotulo}
                </Link>
              ) : (
                <span
                  aria-current={ultimo ? "page" : undefined}
                  className={ultimo ? "text-foreground" : "text-muted-foreground"}
                >
                  {degrau.rotulo}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
