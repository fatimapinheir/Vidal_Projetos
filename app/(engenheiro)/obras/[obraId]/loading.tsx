import { Esqueleto } from "@/components/ui/esqueleto";
import { Carregando } from "@/components/ui/carregando";

/**
 * O que aparece enquanto qualquer seção da obra carrega.
 *
 * Um só para as doze seções, de propósito: fica no segmento `[obraId]`, e o
 * App Router usa o `loading.tsx` ancestral mais próximo para toda tela abaixo
 * dele. Doze esqueletos desenhados um a um seriam doze arquivos para manter
 * sincronizados com telas que mudam toda semana — e o ganho real está em
 * mostrar QUE algo está vindo, não em adivinhar o formato exato.
 *
 * Duas coisas acontecem ao existir este arquivo:
 *
 * 1. A navegação passa a ter resposta imediata. A moldura da obra (seletor,
 *    endereço, barra lateral) já está na tela e o miolo mostra isto — em vez
 *    de a tela ANTERIOR ficar congelada até a nova terminar.
 *
 * 2. O prefetch da barra lateral passa a ter o que guardar. São 19 links
 *    sempre visíveis, e o Next pede todos ao servidor; sem um limite de
 *    `loading` para armazenar, cada pedido custava ~250ms e devolvia 0 kB.
 */
export default function CarregandoSecaoDaObra() {
  return (
    <div aria-busy className="flex flex-col gap-4">
      {/*
        "Carregando" VISÍVEL, com spinner.
        
        Estava só em `sr-only`: o leitor de tela anunciava e quem enxerga via
        retângulos cinza parados, que leem como tela vazia. O movimento do
        spinner é o que distingue "está vindo" de "quebrou".
      */}
      <Carregando />

      {/* Título da seção */}
      <Esqueleto className="h-6 w-48" />

      {/* Faixa de cartões: quase toda seção abre com números no topo. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Esqueleto key={i} className="h-24" />
        ))}
      </div>

      {/* Bloco de conteúdo: tabela, lista ou formulário. */}
      <Esqueleto className="h-64" />
    </div>
  );
}
