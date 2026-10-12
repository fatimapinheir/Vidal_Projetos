"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LayoutList, ListChecks, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { aplicarTemplateOrcamento } from "@/app/actions/orcamento";
import { ETAPAS_ORCAMENTO, TEMPLATE_RESIDENCIAL, totalDeServicos } from "@/lib/orcamento/templates";

/**
 * Oferece os dois templates de orçamento.
 *
 * As premissas de quantidade aparecem ANTES de aplicar, não depois. O template
 * de serviços preenche número em cima de área construída, e número que aparece
 * pronto numa planilha some como premissa e vira verdade — mostrar a conta é o
 * que mantém a estimativa sendo tratada como estimativa.
 */
export function TemplateDialog({
  obraId,
  versaoId,
  metragem,
}: {
  obraId: string;
  versaoId: string;
  metragem: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aplicando, setAplicando] = useState<"etapas" | "servicos" | null>(null);
  const [detalhado, setDetalhado] = useState(false);
  const router = useRouter();

  const semMetragem = !metragem || metragem <= 0;

  async function aplicar(modo: "etapas" | "servicos") {
    setAplicando(modo);
    setErro(null);
    const r = await aplicarTemplateOrcamento(obraId, versaoId, modo);
    setAplicando(null);

    if (r.error) {
      setErro(r.error);
      return;
    }
    setOpen(false);

    /*
     * A mensagem fala de etapas e de itens separadamente.
     *
     * O modo "só etapas" não cria item nenhum, e o texto fixo dizia "0 itens
     * criados" — parecia que nada tinha acontecido, justamente quando 22 etapas
     * acabavam de entrar. Etapa já declarada não é contada de novo: aplicar o
     * mesmo template duas vezes não duplica nada, e dizer "22 adicionadas" na
     * segunda vez seria mentira.
     */
    const partes: string[] = [];
    if (r.etapasAdicionadas) {
      partes.push(
        r.etapasAdicionadas === 1 ? "1 etapa adicionada" : `${r.etapasAdicionadas} etapas adicionadas`
      );
    }
    if (r.criados) partes.push(`${r.criados} itens criados`);
    if (!partes.length) partes.push("Nada a acrescentar — o template já estava aplicado");

    toast.success(
      r.semPreco
        ? `${partes.join(", ")}. ${r.semPreco} itens ficaram sem preço — a composição não foi encontrada na SINAPI.`
        : `${partes.join(", ")}.`
    );
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErro(null); }}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5">
            <Sparkles className="size-4" />
            Usar template
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Começar a partir de um template</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Template 1 */}
          <div className="flex flex-col gap-2 rounded-xl border p-3">
            <div className="flex items-start gap-2.5">
              <LayoutList className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-medium">Só as etapas</p>
                <p className="text-xs text-muted-foreground">
                  Cria as {ETAPAS_ORCAMENTO.length} etapas da obra, sem serviços nem
                  quantidades. Serve de roteiro para você não esquecer nenhuma frente.
                </p>
              </div>
            </div>
            <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              {ETAPAS_ORCAMENTO.join(" · ")}
            </p>
            <div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={aplicando !== null}
                onClick={() => aplicar("etapas")}
              >
                {aplicando === "etapas" ? "Aplicando..." : "Usar só as etapas"}
              </Button>
            </div>
          </div>

          {/* Template 2 */}
          <div className="flex flex-col gap-2 rounded-xl border p-3">
            <div className="flex items-start gap-2.5">
              <ListChecks className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-medium">Etapas e serviços</p>
                <p className="text-xs text-muted-foreground">
                  As mesmas {ETAPAS_ORCAMENTO.length} etapas acima, já com {totalDeServicos()}{" "}
                  serviços distribuídos em {TEMPLATE_RESIDENCIAL.length} delas — preço da SINAPI e
                  quantidade estimada a partir do cadastro da obra. As outras{" "}
                  {ETAPAS_ORCAMENTO.length - TEMPLATE_RESIDENCIAL.length} entram vazias, para você
                  preencher.
                </p>
              </div>
            </div>

            <p className="rounded-lg bg-atencao/10 px-3 py-2 text-xs text-atencao">
              As quantidades são <strong>estimativa</strong>, calculadas sobre a área construída —
              a quantidade real sai do projeto. Confira item a item antes de ativar o orçamento.
            </p>

            <button
              type="button"
              onClick={() => setDetalhado((v) => !v)}
              className="self-start text-xs font-medium text-primary-texto underline underline-offset-4"
            >
              {detalhado ? "Ocultar as premissas" : "Ver as premissas de cálculo"}
            </button>

            {detalhado && (
              <div className="max-h-64 overflow-y-auto rounded-lg border">
                {TEMPLATE_RESIDENCIAL.map((etapa) => (
                  <div key={etapa.nome} className="border-b last:border-0">
                    <p className="bg-muted/60 px-3 py-1.5 text-xs font-semibold">{etapa.nome}</p>
                    {etapa.servicos.map((s) => (
                      <div key={s.descricao} className="flex flex-col gap-0.5 px-3 py-1.5 text-xs">
                        <span className="font-medium">{s.descricao}</span>
                        <span className="text-muted-foreground">{s.regra}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {semMetragem && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                A obra está sem metragem quadrada no cadastro. Sem ela não há de onde tirar as
                quantidades — preencha antes de usar este template.
              </p>
            )}

            <div>
              <Button
                type="button"
                size="sm"
                disabled={aplicando !== null || semMetragem}
                onClick={() => aplicar("servicos")}
              >
                {aplicando === "servicos" ? "Aplicando..." : "Usar etapas e serviços"}
              </Button>
            </div>
          </div>

          {erro && <FieldError>{erro}</FieldError>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
