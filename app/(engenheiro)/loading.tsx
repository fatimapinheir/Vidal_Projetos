import { Esqueleto } from "@/components/ui/esqueleto";
import { Carregando } from "@/components/ui/carregando";

/**
 * O mesmo para as telas de fora da obra — painel, cadastros, SINAPI.
 *
 * São os outros 7 links da barra lateral. As telas de dentro da obra têm o
 * próprio em `obras/[obraId]/loading.tsx`, que é mais próximo e vence para
 * elas.
 */
export default function CarregandoTela() {
  return (
    <div aria-busy className="flex flex-col gap-4">
      {/*
        "Carregando" VISÍVEL, com spinner.
        
        Estava só em `sr-only`: o leitor de tela anunciava e quem enxerga via
        retângulos cinza parados, que leem como tela vazia. O movimento do
        spinner é o que distingue "está vindo" de "quebrou".
      */}
      <Carregando />
      <Esqueleto className="h-6 w-48" />
      <Esqueleto className="h-10" />
      <Esqueleto className="h-80" />
    </div>
  );
}
