"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/**
 * Entrega do lançamento: já recebi, ou recebo tal dia.
 *
 * Um campo de data só, e um checkbox que diz o que aquela data significa.
 * Duas datas lado a lado ("prevista" e "real") seriam o caminho óbvio e o
 * errado: num lançamento — pagamento que já aconteceu — quase sempre só uma
 * das duas é verdade, e a outra ficaria vazia pedindo para ser preenchida com
 * qualquer coisa.
 *
 * O input é DESMONTADO ao trocar, não escondido: campo oculto continua
 * enviando o que tinha dentro, e a data iria para a coluna errada.
 *
 * As duas datas são estado separado, e controlado. Separado porque uma
 * previsão digitada não pode virar data de entrega ao marcar o checkbox — é
 * afirmação diferente sobre a obra. Controlado porque a sugestão vem da data
 * do pagamento, que muda enquanto o formulário está aberto: como
 * `defaultValue` ela mudaria debaixo de um input já montado, que é o que o
 * Base UI reclama e o navegador ignora.
 */
export function CamposEntrega({
  dataInicial = "",
  entregueInicial = "",
  previstaInicial = "",
  className,
}: {
  /** Data sugerida ao marcar "já recebi" — normalmente a do pagamento. */
  dataInicial?: string;
  /** Edição: a entrega que já está gravada, se houver. */
  entregueInicial?: string;
  previstaInicial?: string;
  className?: string;
}) {
  const [recebido, setRecebido] = useState(!!entregueInicial);
  const [prevista, setPrevista] = useState(previstaInicial);
  const [entregue, setEntregue] = useState(entregueInicial);

  function alternar(marcado: boolean) {
    setRecebido(marcado);
    // Sugere a data do pagamento, mas só enquanto o campo estiver vazio:
    // marcar e desmarcar não pode desfazer o que a pessoa digitou.
    if (marcado && !entregue) setEntregue(dataInicial);
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <Field orientation="horizontal">
        <Checkbox
          id="ja_recebido"
          checked={recebido}
          onCheckedChange={(marcado) => alternar(marcado === true)}
        />
        <FieldContent>
          <FieldLabel htmlFor="ja_recebido">Já recebi este material ou serviço</FieldLabel>
        </FieldContent>
      </Field>

      {recebido ? (
        <Field key="recebido" className="sm:max-w-[calc(50%-0.5rem)]">
          <FieldLabel htmlFor="data_entrega_real">Data da entrega</FieldLabel>
          <Input
            id="data_entrega_real"
            name="data_entrega_real"
            type="date"
            value={entregue}
            onChange={(e) => setEntregue(e.target.value)}
            required
          />
          <FieldDescription>A entrega já entra fechada, sem ficar pendente.</FieldDescription>
        </Field>
      ) : (
        <Field key="prevista" className="sm:max-w-[calc(50%-0.5rem)]">
          <FieldLabel htmlFor="data_entrega_prevista">Entrega prevista (opcional)</FieldLabel>
          <Input
            id="data_entrega_prevista"
            name="data_entrega_prevista"
            type="date"
            value={prevista}
            onChange={(e) => setPrevista(e.target.value)}
          />
          <FieldDescription>Deixe vazio se não há nada a receber.</FieldDescription>
        </Field>
      )}
    </div>
  );
}
