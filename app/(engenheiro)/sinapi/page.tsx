import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateBR } from "@/lib/format-date";
import { SinapiSearch } from "./sinapi-search";

export default async function SinapiPage() {
  const supabase = await createClient();

  const { data: tabelaAtiva } = await supabase
    .from("sinapi_tabelas")
    .select("id, mes_referencia")
    .eq("status", "ativa")
    .maybeSingle();

  const { count: itensCount } = tabelaAtiva
    ? await supabase
        .from("sinapi_itens")
        .select("*", { count: "exact", head: true })
        .eq("sinapi_tabela_id", tabelaAtiva.id)
    : { count: 0 };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-lg font-semibold">Tabela SINAPI</h1>
          <p className="text-sm text-muted-foreground">
            Base de preços de referência, compartilhada por todas as obras.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/sinapi/upload">Atualizar tabela</Link>} />
      </div>

      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <p className="text-sm text-muted-foreground">Referência ativa</p>
            <p className="font-heading text-lg font-semibold">
              {tabelaAtiva ? formatDateBR(tabelaAtiva.mes_referencia) : "Nenhuma tabela cadastrada"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Itens</p>
            <p className="font-heading text-lg font-semibold">{itensCount ?? 0}</p>
          </div>
        </CardContent>
      </Card>

      {tabelaAtiva && <SinapiSearch />}
    </div>
  );
}
