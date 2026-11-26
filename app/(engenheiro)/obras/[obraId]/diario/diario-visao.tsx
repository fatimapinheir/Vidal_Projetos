import Link from "next/link";
import { List, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";

export type VisaoDoDiario = "lista" | "calendario";

/**
 * Alterna entre a listagem e o calendário.
 *
 * DIVERGE do `CronogramaVisao`, que guarda a visão em `useState`, e a razão é
 * concreta: o calendário navega por mês com `?mes=`, que é navegação de
 * servidor. Com a aba em estado de cliente, trocar de mês remontaria a página e
 * a aba voltaria para a listagem — a pessoa clicaria em "mês anterior" e cairia
 * na lista, sem entender por quê.
 *
 * Com a aba na URL, os links de mês só precisam carregá-la adiante. De quebra
 * a visão sobrevive ao `router.refresh()` que as ações disparam (excluir uma
 * folha, por exemplo) e o endereço vira compartilhável.
 *
 * Por ser só dois links, isto é componente de SERVIDOR: não há estado, não há
 * JavaScript enviado. O custo é uma ida ao servidor por troca de aba, hoje na
 * casa de 200ms, contra remontar a página inteira no caso errado.
 */
export function DiarioVisao({ base, visao }: { base: string; visao: VisaoDoDiario }) {
  return (
    <div className="flex items-center gap-1">
      <Button
        nativeButton={false}
        size="sm"
        variant={visao === "lista" ? "default" : "outline"}
        render={
          <Link href={`${base}?visao=lista`} scroll={false}>
            <List className="size-4" aria-hidden />
            Listagem
          </Link>
        }
      />
      <Button
        nativeButton={false}
        size="sm"
        variant={visao === "calendario" ? "default" : "outline"}
        render={
          /* Endereço limpo, sem query: o calendário é o padrão da tela. Isso
             também devolve ao mês de hoje, e navegar a partir dali é problema
             dos botões do próprio calendário. */
          <Link href={base} scroll={false}>
            <CalendarDays className="size-4" aria-hidden />
            Calendário
          </Link>
        }
      />
    </div>
  );
}
