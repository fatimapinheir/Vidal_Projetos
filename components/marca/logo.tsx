import { cn } from "@/lib/utils";
import { AnkoraWordmark } from "./ankora-wordmark";

/**
 * Selo compacto: o "Λ" da Ankora com a cunha âmbar, dentro de um quadrado navy.
 *
 * Existe para onde a palavra inteira não cabe — favicon, gaveta do celular
 * fechada, avatar da marca. É o mesmo desenho do primeiro "A" da assinatura,
 * então as duas peças são reconhecíveis uma na outra.
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
 * A marca na tela.
 *
 * É a assinatura inteira por padrão — "Ankora" é uma palavra curta e o
 * desenho já é largo o bastante para funcionar a 20px de altura, então não há
 * motivo para escondê-la atrás de um selo como fazia a marca anterior.
 *
 * A cor vem do contexto (`currentColor`): no navy da lateral ela é branca, na
 * tela de login é escura. O âmbar da perna do "R" é o único tom fixo — é o
 * acento da marca e não negocia com o fundo.
 *
 * O sistema continua sendo "Vidal Projetos" em pasta, repositório e banco. O
 * que a Ankora substitui é o que o usuário vê.
 */
export function Logo({
  somenteSelo = false,
  className,
}: {
  somenteSelo?: boolean;
  className?: string;
}) {
  if (somenteSelo) return <AnkoraSelo className={className} />;
  return <AnkoraWordmark className={cn("h-5", className)} />;
}
