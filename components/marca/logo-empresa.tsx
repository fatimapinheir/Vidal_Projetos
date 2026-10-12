import Image from "next/image";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

/**
 * A logo da empresa que opera o sistema — a que o cliente da obra vê.
 *
 * Fica no topo do menu, onde antes estava a Ankora. A troca é de propósito: o
 * sistema aparece diante do cliente final como ferramenta da construtora, não
 * como produto de terceiro. A Ankora assina no pé da lateral.
 *
 * Sem logo enviada, cai na Ankora. É o estado de uma instalação recém-criada,
 * e um espaço vazio no topo do menu pareceria defeito.
 *
 * O arquivo mora em bucket público (migração 0051): a URL é direta e estável,
 * sem link que vence no meio da sessão de quem está olhando.
 */
export function LogoEmpresa({
  url,
  nome,
  className,
}: {
  url: string | null;
  /** Nome da empresa, para quem lê por leitor de tela. */
  nome?: string | null;
  className?: string;
}) {
  if (!url) return <Logo className={className} />;

  return (
    <Image
      src={url}
      alt={nome ?? "Logo da empresa"}
      width={400}
      height={400}
      unoptimized
      /*
        `object-contain` com altura fixa: a logo enviada pode ter qualquer
        proporção — a A2 é quase quadrada, outra pode ser larga —, e sem isso
        uma delas esticaria. A altura manda, a largura acompanha.
      */
      className={cn("h-11 w-auto self-center object-contain", className)}
    />
  );
}
