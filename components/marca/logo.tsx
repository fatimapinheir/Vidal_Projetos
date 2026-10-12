import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Selo compacto: o "Λ" da Ankora com a cunha âmbar, dentro de um quadrado navy.
 *
 * Continua desenhado em SVG, e não recortado da imagem: aqui são duas formas
 * geométricas simples, que em vetor ficam nítidas em qualquer tamanho e pesam
 * nada. O desenho da palavra inteira é que não se reconstrói — ver `Logo`.
 */
export function AnkoraSelo({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-xl bg-marca-navy shadow-xs",
        className
      )}
    >
      <svg viewBox="0 0 104 100" className="h-4 w-auto">
        <path d="M0,100 L38,0 L46,0 L84,100 L66,100 L42,36 L18,100 Z" fill="#ffffff" />
        <path d="M60,52 L86,52 L104,100 L78,100 Z" className="fill-marca-ambar" />
      </svg>
    </span>
  );
}

/**
 * A assinatura da Ankora, como arquivo.
 *
 * Era um SVG reconstruído a partir da marca — letras montadas por coordenadas.
 * A reconstrução errava justamente no que a marca tem de característico: o "A"
 * saía sem travessão e o "R" sem perna, e ninguém reconhecia o desenho. Marca
 * não se aproxima; ou é o arquivo, ou é outra coisa.
 *
 * O PNG tem fundo transparente e arte clara, então só funciona sobre superfície
 * escura — que é onde ela aparece: o navy da lateral e a chapa do login.
 */
export function Logo({
  somenteSelo = false,
  className,
}: {
  somenteSelo?: boolean;
  className?: string;
}) {
  if (somenteSelo) return <AnkoraSelo className={className} />;
  return (
    <Image
      src="/marca/ankora.png"
      alt="Ankora"
      width={600}
      height={222}
      priority
      /*
        `self-start` não é enfeite: dentro de um contêiner flex em coluna — que
        é o pé da lateral — a imagem estica para a largura toda por padrão
        (`align-items: stretch`), e com a altura fixa pelo `h-*` a marca sai
        achatada. `w-auto` sozinho não impede, porque quem manda no eixo
        transversal é o alinhamento, não a largura.
      */
      className={cn("h-5 w-auto self-start", className)}
    />
  );
}
