import { Esqueleto } from "@/components/ui/esqueleto";

/**
 * O mesmo para as telas de fora da obra — painel, cadastros, SINAPI.
 *
 * São os outros 7 links da barra lateral. As telas de dentro da obra têm o
 * próprio em `obras/[obraId]/loading.tsx`, que é mais próximo e vence para
 * elas.
 */
export default function CarregandoTela() {
  return (
    <div role="status" aria-busy className="flex flex-col gap-4">
      <span className="sr-only">Carregando...</span>
      <Esqueleto className="h-6 w-48" />
      <Esqueleto className="h-10" />
      <Esqueleto className="h-80" />
    </div>
  );
}
