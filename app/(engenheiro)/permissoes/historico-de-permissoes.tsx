import { Badge } from "@/components/ui/badge";

export type EventoPermissao = {
  id: number;
  acao: string;
  concedida: boolean;
  em: string;
  alvo: string;
  por: string | null;
};

/**
 * O histórico (0085).
 *
 * Mostra do mais recente para o mais antigo, com o que foi feito, em quem, e
 * por quem. Os eventos semeados pela migração aparecem sem autor — e dizem
 * isso em vez de ficarem com um campo vazio e ambíguo.
 */
export function HistoricoDePermissoes({
  eventos,
  rotulos,
}: {
  eventos: EventoPermissao[];
  /** `acao` -> rótulo legível, vindo do catálogo. */
  rotulos: Record<string, string>;
}) {
  if (!eventos.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma alteração registrada ainda.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y text-sm">
      {eventos.map((e) => (
        <li key={e.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-2.5">
          <Badge
            variant={e.concedida ? "secondary" : "destructive"}
            className="font-normal"
          >
            {e.concedida ? "liberou" : "tirou"}
          </Badge>
          <span className="font-medium">
            {e.acao === "administrador"
              ? "Administrar permissões"
              : (rotulos[e.acao] ?? e.acao)}
          </span>
          <span className="text-muted-foreground">de {e.alvo}</span>
          {/* `w-full` numa linha própria no celular: a data e o autor são o
              detalhe, e empurrá-los para o lado espremeria o que importa. */}
          <span className="w-full text-xs text-muted-foreground sm:w-auto">
            {new Date(e.em).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {e.por ? ` · por ${e.por}` : " · registro inicial do sistema"}
          </span>
        </li>
      ))}
    </ul>
  );
}
