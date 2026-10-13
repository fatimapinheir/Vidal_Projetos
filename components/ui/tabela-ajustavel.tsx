"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type ColunaAjustavel = {
  chave: string;
  titulo: string;
  /** Largura inicial em pixels. A soma de todas é a largura natural da tabela. */
  largura: number;
  /** Abaixo disto a coluna deixa de caber um rótulo. */
  minima?: number;
  /** Cabeçalho à direita — valores e a coluna de ações. */
  direita?: boolean;
  /**
   * Coluna que não se arrasta. A de ações tem a largura dos botões dentro
   * dela; deixar espremê-la só quebraria a linha.
   */
  fixa?: boolean;
};

const MINIMA_PADRAO = 72;
const PASSO_TECLADO = 16;

function assinarArmazenamento(aoMudar: () => void) {
  // Outra aba mexeu nas larguras: esta acompanha. O evento `storage` não
  // dispara na aba que escreveu, então não há laço com o efeito que salva.
  window.addEventListener("storage", aoMudar);
  return () => window.removeEventListener("storage", aoMudar);
}

/**
 * Uma tabela cujas colunas o usuário arrasta para o tamanho que quiser.
 *
 * Nasceu da lista de ordens de compra. Ela tem sete colunas, e as duas
 * primeiras — descrição e fornecedor — são textos longos que o navegador
 * alargava até empurrar entrega e ações para fora da tela. A saída que
 * sobrava era baixar o zoom do navegador para 75%, encolhendo junto o resto
 * do sistema.
 *
 * Larguras fixas por padrão resolvem o empurrão: descrição e fornecedor
 * truncam e tudo cabe em 100%. Mas truncar sem saída esconde informação, e
 * daí a alça: quem precisa ler a descrição inteira alarga a coluna e a tabela
 * rola na horizontal. A escolha fica guardada no navegador de quem a fez.
 *
 * As LINHAS chegam prontas como `children`, montadas no servidor — mesmo
 * arranjo de `EtapaColapsavel`. É o que permite a página continuar sendo
 * componente de servidor e passar botões e links já renderizados para dentro.
 */
export function TabelaAjustavel({
  id,
  colunas,
  children,
}: {
  /** Identifica a tabela no armazenamento do navegador. Estável entre deploys. */
  id: string;
  colunas: ColunaAjustavel[];
  /** O `<tbody>` pronto. */
  children: ReactNode;
}) {
  const chaveArmazenada = `vidal-colunas-${id}`;

  /*
   * O que está guardado entra por `useSyncExternalStore`, e não por efeito.
   *
   * O armazenamento do navegador não existe no servidor: lê-lo durante a
   * renderização daria um HTML diferente do que o servidor mandou. Este gancho
   * é feito exatamente para isso — devolve o retrato do servidor (nada) na
   * primeira passada e o do navegador logo depois da hidratação, sem
   * `setState` em efeito.
   */
  const salvoBruto = useSyncExternalStore(
    assinarArmazenamento,
    () => {
      try {
        return localStorage.getItem(chaveArmazenada);
      } catch {
        // Janela anônima, armazenamento bloqueado, captura de miniatura: a
        // tabela funciona com as larguras padrão.
        return null;
      }
    },
    () => null
  );

  const padrao = useMemo(
    () => Object.fromEntries(colunas.map((c) => [c.chave, c.largura])),
    [colunas]
  );

  const salvo = useMemo(() => {
    if (!salvoBruto) return null;
    try {
      const lido = JSON.parse(salvoBruto) as Record<string, unknown>;
      // Só números, e só colunas que ainda existem: um deploy que renomeia ou
      // remove coluna não pode ressuscitar a largura de uma que saiu.
      return Object.fromEntries(
        Object.keys(padrao)
          .filter((chave) => typeof lido[chave] === "number" && (lido[chave] as number) > 0)
          .map((chave) => [chave, lido[chave] as number])
      );
    } catch {
      return null;
    }
  }, [salvoBruto, padrao]);

  /** O que o usuário mexeu NESTA visita. Vence o que estava guardado. */
  const [ajustes, setAjustes] = useState<Record<string, number>>({});
  const [arrastando, setArrastando] = useState(false);

  const larguras = useMemo(
    () => ({ ...padrao, ...salvo, ...ajustes }),
    [padrao, salvo, ajustes]
  );

  useEffect(() => {
    if (!Object.keys(ajustes).length) return;
    try {
      localStorage.setItem(chaveArmazenada, JSON.stringify({ ...salvo, ...ajustes }));
    } catch {
      // Sem onde guardar, a largura vale só para esta visita.
    }
    // `salvo` de fora das dependências de propósito: ele vem do próprio
    // armazenamento, e incluí-lo faria o efeito rodar de novo a cada escrita.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ajustes, chaveArmazenada]);

  /*
   * O arrasto usa CAPTURA DE PONTEIRO, não ouvintes no documento.
   *
   * Arrastando rápido o ponteiro sai de uma alça de seis pixels, e sem a
   * captura o redimensionamento parava no meio do gesto. Com ela, os eventos
   * continuam chegando na alça até soltar, mesmo com o ponteiro fora da
   * tabela — e nada precisa ser pendurado no documento nem desfeito depois.
   */
  const inicio = useRef<{ chave: string; minima: number; x: number; largura: number } | null>(null);

  const ajustar = useCallback((chave: string, valor: number, minima: number) => {
    setAjustes((atuais) => ({ ...atuais, [chave]: Math.max(minima, Math.round(valor)) }));
  }, []);

  const soma = colunas.reduce((total, c) => total + larguras[c.chave], 0);
  const alterado = colunas.some((c) => larguras[c.chave] !== c.largura);

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={cn(
          "barra-rolagem overflow-x-auto rounded-xl border",
          // Sem isto, arrastar seleciona o texto da tabela inteira.
          arrastando && "cursor-col-resize select-none"
        )}
      >
        {/*
          `table-fixed` com `<colgroup>`: é o que faz a largura ser a que
          dissemos, em vez da que o navegador deduz do conteúdo.

          `width` é a soma e `min-w-full` garante que a tabela ocupe a caixa
          quando a soma for menor — aí as colunas crescem na proporção pedida,
          em vez de deixar uma faixa vazia à direita. Passando da caixa, a
          tabela rola, que é o que a alça serve para provocar.
        */}
        <table className="min-w-full table-fixed caption-bottom text-sm" style={{ width: soma }}>
          <colgroup>
            {colunas.map((c) => (
              <col key={c.chave} style={{ width: larguras[c.chave] }} />
            ))}
          </colgroup>
          <TableHeader>
            <TableRow>
              {colunas.map((coluna) => {
                const minima = coluna.minima ?? MINIMA_PADRAO;
                return (
                  <TableHead
                    key={coluna.chave}
                    className={cn("relative", coluna.direita && "text-right")}
                  >
                    <span className="block truncate">{coluna.titulo}</span>
                    {!coluna.fixa && (
                      /*
                        A alça é larga para pegar (seis pixels) e fina para
                        ver (um pixel, e só no hover). Visível em todas as
                        colunas o tempo todo, o cabeçalho viraria uma grade.
                      */
                      <span
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`Ajustar a largura da coluna ${coluna.titulo}`}
                        tabIndex={0}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.currentTarget.setPointerCapture(e.pointerId);
                          inicio.current = {
                            chave: coluna.chave,
                            minima,
                            x: e.clientX,
                            largura: larguras[coluna.chave],
                          };
                          setArrastando(true);
                        }}
                        onPointerMove={(e) => {
                          const origem = inicio.current;
                          if (!origem) return;
                          ajustar(
                            origem.chave,
                            origem.largura + e.clientX - origem.x,
                            origem.minima
                          );
                        }}
                        onPointerUp={(e) => {
                          e.currentTarget.releasePointerCapture(e.pointerId);
                          inicio.current = null;
                          setArrastando(false);
                        }}
                        onPointerCancel={() => {
                          inicio.current = null;
                          setArrastando(false);
                        }}
                        // Duplo clique devolve a coluna ao tamanho de fábrica.
                        onDoubleClick={() => ajustar(coluna.chave, coluna.largura, minima)}
                        onKeyDown={(e) => {
                          // Teclado também ajusta: a alça é pequena demais
                          // para quem não aponta com precisão.
                          const passo =
                            e.key === "ArrowLeft"
                              ? -PASSO_TECLADO
                              : e.key === "ArrowRight"
                                ? PASSO_TECLADO
                                : 0;
                          if (!passo) return;
                          e.preventDefault();
                          ajustar(coluna.chave, larguras[coluna.chave] + passo, minima);
                        }}
                        className="absolute top-0 right-[-3px] bottom-0 z-10 w-1.5 cursor-col-resize touch-none after:absolute after:inset-y-1.5 after:left-[2px] after:w-px after:bg-transparent hover:after:bg-primary focus-visible:outline-none focus-visible:after:bg-primary"
                      />
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          {children}
        </table>
      </div>

      {/* Só aparece depois de mexer: um botão de desfazer visível o tempo todo
          anuncia um problema que a maioria não tem. */}
      {alterado && (
        <button
          type="button"
          onClick={() => setAjustes(padrao)}
          className="self-end text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          Restaurar largura das colunas
        </button>
      )}
    </div>
  );
}
