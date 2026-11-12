import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { NovaObraForm } from "./nova-obra-form";
import { engenheirosDisponiveis } from "@/lib/auth/papeis";

export default async function NovaObraPage() {
  const supabase = await createClient();
  const [{ data: tipos }, engenheiros] = await Promise.all([
    supabase.from("obra_tipos").select("id, nome").order("nome"),
    engenheirosDisponiveis(supabase),
  ]);

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Nova obra</CardTitle>
      </CardHeader>
      <CardContent>
        <NovaObraForm tipos={tipos ?? []} engenheiros={engenheiros} />
      </CardContent>
    </Card>
  );
}
