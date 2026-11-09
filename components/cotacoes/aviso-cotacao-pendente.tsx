import Link from "next/link";
import { Scale } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * O aviso de que existe decisão parada — e NADA além disso.
 *
 * É a única coisa desta feature que aparece em visão geral, por decisão de
 * produto e com uma razão boa: valor cotado não é dinheiro da obra. Somá-lo em
 * qualquer painel misturaria o que está comprometido com o que talvez nunca
 * saia, e o cliente leria como gasto um preço que ninguém aceitou.
 *
 * Por isso aqui só tem contagem. Quanto custa é assunto da tela da cotação,
 * onde a pergunta é "qual destas" e o valor serve para responder.
 */
export function AvisoCotacaoPendente({
  quantas,
  href,
  lado,
}: {
  quantas: number;
  href: string;
  /** Muda só a frase: para o cliente a decisão é dele, para o engenheiro é espera. */
  lado: "engenheiro" | "cliente";
}) {
  if (quantas < 1) return null;

  const plural = quantas > 1;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3.5">
      <div className="flex items-start gap-2.5">
        <Scale className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div className="text-sm">
          <p className="font-medium">
            {lado === "cliente"
              ? `${quantas} cotação${plural ? "s" : ""} esperando sua escolha`
              : `${quantas} cotação${plural ? "s" : ""} aguardando o cliente`}
          </p>
          <p className="text-muted-foreground">
            {lado === "cliente"
              ? "Compare as propostas e escolha uma. Só a escolhida vira compra."
              : "Enviadas e ainda sem decisão. Você também pode decidir por ele."}
          </p>
        </div>
      </div>

      <Button size="sm" render={<Link href={href} />} nativeButton={false}>
        {lado === "cliente" ? "Ver e escolher" : "Ver cotações"}
      </Button>
    </div>
  );
}
