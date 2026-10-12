"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { aplicarTemplateCronograma, importarDoOrcamento } from "@/app/actions/cronograma";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TEMPLATES_CRONOGRAMA, contarTarefas, templateDaFaixa } from "@/lib/cronograma/templates";

/** Traz as etapas do orçamento ativo para o cronograma. As tarefas você cria depois. */
export function ImportarOrcamentoButton({ obraId }: { obraId: string }) {
  const [pendente, setPendente] = useState(false);
  const router = useRouter();

  async function importar() {
    setPendente(true);
    const r = await importarDoOrcamento(obraId);
    setPendente(false);

    if (r.error) {
      toast.error(r.error);
      return;
    }
    toast.success(
      `${r.criadas} etapa(s) importada(s) do orçamento.` +
        (r.puladas ? ` ${r.puladas} já estavam no cronograma.` : "")
    );
    router.refresh();
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={importar} disabled={pendente}>
      <Download className="size-4" />
      {pendente ? "Importando..." : "Importar etapas do orçamento"}
    </Button>
  );
}

/**
 * Monta o cronograma a partir de um template.
 *
 * Mostra os dois e destaca o sugerido pela faixa da obra, em vez de escolher
 * sozinho: faixa é um campo do cadastro que pode estar em branco ou errado, e
 * montar 136 tarefas pela faixa errada custa mais do que perguntar.
 *
 * A diferença de qualidade entre os templates aparece na tela. O de MCMV tem
 * durações de obra real; o de alto padrão tem 1 dia em tudo. Cronograma com
 * duração falsa que parece verdadeira é pior que cronograma vazio.
 */
export function TemplateCronogramaDialog({
  obraId,
  faixaDaObra,
}: {
  obraId: string;
  faixaDaObra: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [aplicando, setAplicando] = useState<string | null>(null);
  const router = useRouter();
  const sugerido = templateDaFaixa(faixaDaObra);

  async function aplicar(id: string) {
    setAplicando(id);
    const r = await aplicarTemplateCronograma(obraId, id);
    setAplicando(null);

    if (r.error) {
      toast.error(r.error);
      return;
    }
    setOpen(false);
    toast.success(`${r.tarefas} tarefas em ${r.etapas} etapas.`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <Sparkles className="size-4" />
            Usar template
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Montar o cronograma por template</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {TEMPLATES_CRONOGRAMA.map((t) => {
            const ehSugerido = sugerido?.id === t.id;
            return (
              <div
                key={t.id}
                className={`flex flex-col gap-2 rounded-xl border p-3 ${
                  ehSugerido ? "border-primary/40 bg-accent/30" : ""
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{t.nome}</p>
                  {ehSugerido && <Badge variant="secondary">faixa desta obra</Badge>}
                  {t.duracoesReais ? (
                    <Badge variant="outline">durações de obra real</Badge>
                  ) : (
                    <Badge variant="outline">durações a definir</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.etapas.length} etapas · {contarTarefas(t)} tarefas
                </p>
                <p
                  className={`rounded-lg px-3 py-2 text-xs ${
                    t.duracoesReais ? "bg-muted text-muted-foreground" : "bg-atencao/10 text-atencao"
                  }`}
                >
                  {t.observacao}
                </p>
                <div>
                  <Button
                    type="button"
                    size="sm"
                    variant={ehSugerido ? "default" : "outline"}
                    disabled={aplicando !== null}
                    onClick={() => aplicar(t.id)}
                  >
                    {aplicando === t.id ? "Montando..." : `Usar ${t.nome}`}
                  </Button>
                </div>
              </div>
            );
          })}

          <p className="text-xs text-muted-foreground">
            As tarefas entram em sequência, uma começando quando a anterior termina. O que for
            paralelo na sua obra você solta depois, e o cronograma recalcula.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
