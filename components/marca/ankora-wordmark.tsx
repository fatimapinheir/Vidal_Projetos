import { cn } from "@/lib/utils";

/*
 * Grade do desenho: altura de caixa alta 100, linha de base em y=100, haste de
 * 17. As letras são geométricas — o "A" não tem travessão, o "O" é círculo
 * perfeito — e o "R" não tem perna: quem faz o papel dela é a cunha âmbar, que
 * é o acento da marca. Tirar a cunha quebra a leitura da palavra de propósito,
 * para que ninguém a trate como enfeite removível.
 */
const LARGURA = 576;

/** "A" sem travessão: um Λ de hastes retas. */
function letraA(x: number) {
  return `M${x},100 L${x + 38},0 L${x + 46},0 L${x + 84},100 L${x + 66},100 L${x + 42},36 L${x + 18},100 Z`;
}

const N = (x: number) =>
  `M${x},100 L${x},0 L${x + 17},0 L${x + 63},70 L${x + 63},0 L${x + 80},0 L${x + 80},100 L${x + 63},100 L${x + 17},30 L${x + 17},100 Z`;

const K = (x: number) =>
  `M${x},0 L${x + 17},0 L${x + 17},40 L${x + 55},0 L${x + 78},0 L${x + 33},47 L${x + 80},100 L${x + 57},100 L${x + 17},55 L${x + 17},100 L${x},100 Z`;

/** Anel: círculo externo r=50 com o miolo r=33 vazado (fill-rule evenodd). */
const O = (x: number) =>
  `M${x + 50},0 A50,50 0 1 0 ${x + 50},100 A50,50 0 1 0 ${x + 50},0 Z ` +
  `M${x + 50},17 A33,33 0 1 1 ${x + 50},83 A33,33 0 1 1 ${x + 50},17 Z`;

/** "R" sem perna: haste + barriga arredondada. */
const R = (x: number) =>
  `M${x},100 L${x},0 L${x + 52},0 C${x + 74},0 ${x + 88},12 ${x + 88},29 C${x + 88},46 ${x + 74},58 ${x + 52},58 L${x + 17},58 L${x + 17},100 Z ` +
  `M${x + 17},17 L${x + 52},17 C${x + 63},17 ${x + 70},22 ${x + 70},29 C${x + 70},36 ${x + 63},41 ${x + 52},41 L${x + 17},41 Z`;

/** A perna do "R", em âmbar: cunha que desce da barriga até a linha de base. */
const PERNA = (x: number) => `M${x + 44},52 L${x + 70},52 L${x + 92},100 L${x + 66},100 Z`;

const CORPO = [letraA(0), N(96), K(188), O(280), R(392), letraA(492)].join(" ");

/**
 * Assinatura "ANKORA".
 *
 * Desenho vetorial próprio, não fonte: a palavra precisa sair idêntica em
 * qualquer máquina, e a cunha âmbar não existe em fonte nenhuma. Herda a cor
 * do texto (`currentColor`), então a mesma peça serve no navy da lateral e no
 * claro da tela de login — é a razão de não ser um arquivo de imagem.
 */
export function AnkoraWordmark({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${LARGURA} 100`}
      role="img"
      aria-label="Ankora"
      className={cn("h-5 w-auto", className)}
    >
      <path d={CORPO} fill="currentColor" fillRule="evenodd" />
      <path d={PERNA(392)} className="fill-marca-ambar" />
    </svg>
  );
}
