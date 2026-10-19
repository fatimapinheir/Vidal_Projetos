"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";

/**
 * O cartão de número-manchete do sistema.
 *
 * Três coisas carregam o desenho, e todas vêm da marca:
 *
 * 1. O RÓTULO em navy cheio, não em cinza. Cinza é a cor do que se lê depois;
 *    aqui o rótulo é a pergunta que o número responde, e sem ele o número não
 *    significa nada. Lê-se de cima para baixo: pergunta, depois resposta.
 *
 * 2. O TRAÇO AZUL entre os dois. É o único elemento decorativo, e ele existe
 *    para separar a pergunta da resposta sem gastar uma linha de régua
 *    cinzenta. Azul da marca — é a cor que a Ankora assina.
 *
 * 3. O "R$" MENOR que os dígitos. O símbolo é contexto, o número é o dado;
 *    com o mesmo corpo, os dois disputam o olho e a leitura trava num
 *    "erre-cifrão" antes de chegar ao que importa.
 *
 * O ícone de ajuda é opcional e abre um balão. Número de painel quase sempre
 * precisa de uma frase — "pago é o que foi marcado como pago na ordem" — e
 * essa frase não cabe no cartão sem virar parágrafo.
 */
export function CardNumero({
  rotulo,
  valor,
  descricao,
  ajuda,
  tom = "neutro",
  className,
}: {
  rotulo: string;
  /** Já formatado. Moeda em pt-BR ganha o tratamento do "R$" menor. */
  valor: string | number;
  /** Uma linha abaixo do número, em cinza. */
  descricao?: string;
  /** Conteúdo do balão do ícone. Ausente, o ícone não aparece. */
  ajuda?: ReactNode;
  /** `sucesso` para dinheiro que entrou, `alerta` para o que exige ação. */
  tom?: "neutro" | "sucesso" | "alerta";
  className?: string;
}) {
  const corDoValor =
    tom === "alerta" ? "text-destructive" : tom === "sucesso" ? "text-sucesso" : "text-foreground";

  return (
    <div
      className={cn(
        /*
          Sem borda, com sombra. A separação vem da elevação, não de um
          contorno — numa fileira de quatro, quatro contornos viram uma grade
          e o olho passa a ver a grade em vez dos números.
          
          `rounded-3xl` é o raio da marca em peça grande; os cartões de dentro
          das seções usam `rounded-xl`, e a diferença de raio é o que diz qual
          é o nível de cada caixa.
        */
        "relative flex flex-col gap-2 rounded-3xl bg-card p-5 shadow-sm ring-1 ring-black/[0.04] transition-shadow hover:shadow-md dark:ring-white/[0.06]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-heading text-base leading-tight font-bold text-pretty">{rotulo}</p>
        {ajuda && <BalaoDeAjuda rotulo={rotulo}>{ajuda}</BalaoDeAjuda>}
      </div>

      {/* O traço fica preso à esquerda e não acompanha a largura do rótulo:
          alinhado ao número, ele vira a base de onde a resposta sai. */}
      <span aria-hidden className="block h-[3px] w-10 rounded-full bg-marca-azul" />

      <p className={cn("font-heading leading-none font-bold tabular-nums", corDoValor)}>
        <Moeda valor={valor} />
      </p>

      {descricao && <p className="text-xs leading-snug text-muted-foreground">{descricao}</p>}
    </div>
  );
}

/**
 * O "R$" em corpo menor e peso normal, os dígitos em corpo grande.
 *
 * Só quando o valor REALMENTE começa com "R$ " — um número puro (a contagem de
 * equipamentos, por exemplo) passa inteiro e fica do mesmo tamanho.
 */
function Moeda({ valor }: { valor: string | number }) {
  const texto = String(valor);
  const moeda = texto.startsWith("R$ ");

  if (!moeda) return <span className="text-3xl">{texto}</span>;

  return (
    <>
      <span className="mr-1 align-baseline text-xl font-semibold opacity-70">R$</span>
      <span className="text-3xl">{texto.slice(3)}</span>
    </>
  );
}

/**
 * O balão do ícone.
 *
 * Mesma peça de `AjudaDaPagina`, em miniatura: ali o alvo convive com um
 * título de tela e pede 32px de área; aqui ele divide a linha com o rótulo do
 * cartão e um alvo daquele tamanho empurraria o texto.
 */
function BalaoDeAjuda({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={`O que é: ${rotulo}`}
        /*
          O ícone usa `primary-texto`, um passo mais escuro que o azul do
          traço. É a mesma razão pela qual o token existe: azul de marca tem
          contraste de superfície, não de texto, e um ícone de 20px nele fica
          no limite da leitura sobre branco.
        */
        className="-mt-0.5 -mr-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-primary-texto transition-colors hover:bg-primary/12 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Info className="size-5" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="end" className="z-50">
          <Popover.Popup className="max-w-[min(22rem,calc(100vw-2rem))] origin-[var(--transform-origin)] rounded-xl border bg-popover p-3.5 text-sm text-popover-foreground shadow-lg outline-none transition-[transform,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            <Popover.Title className="mb-1 font-heading text-sm font-semibold">
              {rotulo}
            </Popover.Title>
            <Popover.Description
              render={<div className="flex flex-col gap-2 leading-snug text-muted-foreground" />}
            >
              {children}
            </Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
