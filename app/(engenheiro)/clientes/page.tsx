import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { RenomearCliente } from "./renomear-cliente";

export default async function ClientesPage() {
  const supabase = await createClient();

  const [{ data: clientes }, { data: vinculos }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, nome, email, telefone")
      .eq("role", "cliente")
      .order("nome"),
    supabase.from("obra_clientes").select("cliente_id, obra_id, obras(nome)"),
  ]);

  const obrasPorCliente = new Map<string, { id: string; nome: string }[]>();
  for (const v of vinculos ?? []) {
    const obra = v.obras as unknown as { nome: string } | null;
    const lista = obrasPorCliente.get(v.cliente_id) ?? [];
    lista.push({ id: v.obra_id, nome: obra?.nome ?? "—" });
    obrasPorCliente.set(v.cliente_id, lista);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-lg font-semibold">Clientes</h1>
        <p className="text-sm text-muted-foreground">
          Quem acompanha as obras pelo portal. O vínculo de um cliente com uma obra é feito na{" "}
          <strong>edição da obra</strong> — aqui é a visão geral de quem já tem acesso e a quê — e onde se corrige um nome.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {clientes?.map((c) => {
          const obras = obrasPorCliente.get(c.id) ?? [];
          return (
            <div key={c.id} className="flex flex-col gap-2 rounded-xl border p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <RenomearCliente id={c.id} nome={c.nome} />
                <p className="text-sm text-muted-foreground">{c.email ?? "—"}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {obras.length ? (
                  obras.map((o) => (
                    <Link key={o.id} href={`/obras/${o.id}`}>
                      <Badge variant="outline">{o.nome}</Badge>
                    </Link>
                  ))
                ) : (
                  <span className="text-muted-foreground">
                    Sem obra vinculada — o portal dele aparece vazio.
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {!clientes?.length && (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhum cliente cadastrado. Eles são criados ao vincular um cliente a uma obra.
          </p>
        )}
      </div>
    </div>
  );
}
