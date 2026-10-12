"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Dispara a impressão do navegador, de onde sai o PDF.
 *
 * Gerar PDF no servidor exigiria um navegador headless só para isso. A
 * impressão nativa dá o mesmo resultado, respeita o CSS de impressão e já vem
 * com "Salvar como PDF" em qualquer sistema.
 */
export function BotaoImprimir() {
  return (
    <div className="rdo-acoes">
      <Button type="button" onClick={() => window.print()}>
        <Printer className="size-4" />
        Baixar / imprimir
      </Button>
      <p className="text-xs text-muted-foreground">
        Na janela de impressão, escolha &ldquo;Salvar como PDF&rdquo;.
      </p>
    </div>
  );
}
