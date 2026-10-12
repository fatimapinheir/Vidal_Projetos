import {
  ArrowLeftRight,
  Banknote,
  Barcode,
  CreditCard,
  Diamond,
  ReceiptText,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FormaPagamento } from "@/lib/types/database.types";
import type { ResumoPorForma } from "@/lib/compras/lancamentos";

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Cada forma tem ícone e cor própria.
 *
 * A cor não carrega significado — não existe forma de pagamento "melhor" ou
 * "pior". Ela serve só para a lista virar quatro linhas distinguíveis de
 * relance em vez de um bloco cinza, e por isso sai da rampa de gráfico, que é
 * uma sequência neutra, e não da paleta de status.
 */
const FORMAS: Record<FormaPagamento, { rotulo: string; Icone: LucideIcon; cor: string }> = {
  pix: { rotulo: "Pix", Icone: Diamond, cor: "bg-chart-1" },
  boleto: { rotulo: "Boleto", Icone: Barcode, cor: "bg-grafico-pago" },
  transferencia: { rotulo: "Transferência", Icone: ArrowLeftRight, cor: "bg-grafico-a-vencer" },
  cartao_credito: { rotulo: "Cartão de crédito", Icone: CreditCard, cor: "bg-grafico-enviado" },
  cartao_debito: { rotulo: "Cartão de débito", Icone: CreditCard, cor: "bg-chart-3" },
  dinheiro: { rotulo: "Dinheiro", Icone: Banknote, cor: "bg-chart-2" },
  cheque: { rotulo: "Cheque", Icone: ReceiptText, cor: "bg-chart-4" },
  outro: { rotulo: "Outro", Icone: Wallet, cor: "bg-chart-5" },
};

export function ResumoFormasPagamento({ resumo }: { resumo: ResumoPorForma[] }) {
  if (!resumo.length) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nenhum pagamento registrado ainda.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {resumo.map(({ forma, total, percentual }) => {
        const { rotulo, Icone, cor } = FORMAS[forma];
        return (
          <li key={forma} className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
              <Icone className="size-[18px] text-muted-foreground" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">{rotulo}</span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {moeda(total)}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-grafico-trilho">
                  <div
                    className={cn("h-full rounded-full", cor)}
                    style={{ width: `${Math.max(2, percentual)}%` }}
                  />
                </div>
                <span className="w-11 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                  {percentual.toFixed(1).replace(".", ",")}%
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
