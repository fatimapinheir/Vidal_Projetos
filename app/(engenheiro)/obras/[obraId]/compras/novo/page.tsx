import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { NovaCompraForm } from "./nova-compra-form";

export default async function NovaCompraPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const supabase = await createClient();
  const { data: fornecedores } = await supabase.from("fornecedores").select("id, nome").order("nome");

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Nova ordem de compra</CardTitle>
      </CardHeader>
      <CardContent>
        <NovaCompraForm obraId={obraId} fornecedores={fornecedores ?? []} />
      </CardContent>
    </Card>
  );
}
