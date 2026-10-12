import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { LancamentoForm } from "@/components/compras/lancamento-form";

/**
 * O cliente registrando um pagamento da obra dele.
 *
 * É a única escrita financeira aberta ao cliente, e de propósito: ele paga
 * coisas que o engenheiro não vê passar — IPTU, uma taxa, um material
 * comprado direto. Sem este caminho, esses valores ficariam fora do custo da
 * obra e o "já gasto" mentiria para baixo.
 *
 * Quem limita é a RLS: `cli_insert_lancamento` só aceita linha marcada como
 * lançamento e em obra dele. Ordem de compra, aprovação e recebimento
 * continuam sendo do engenheiro.
 */
export default async function PortalNovoLancamentoPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  await requireRole("cliente");
  const supabase = await createClient();

  const [{ data: obra }, { data: fornecedores }, { data: categorias }] = await Promise.all([
    supabase.from("obras").select("nome").eq("id", obraId).maybeSingle(),
    supabase.from("fornecedores").select("id, nome").eq("ativo", true).order("nome"),
    supabase
      .from("categorias_financeiras")
      .select("id, nome, tipo_item")
      .eq("ativo", true)
      .order("nome"),
  ]);

  if (!obra) notFound();

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="-ml-2"
          render={
            <Link href={`/portal/obras/${obraId}/compras`}>
              <ChevronLeft className="size-4" />
              Lançamentos financeiros
            </Link>
          }
        />
      </div>

      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>Novo lançamento</CardTitle>
          <CardDescription>
            Registre aqui um pagamento da obra que você fez — IPTU, água, uma taxa. Ele entra no
            custo total e aparece para o engenheiro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LancamentoForm
            obraId={obraId}
            fornecedores={fornecedores ?? []}
            categorias={categorias ?? []}
            voltarPara={`/portal/obras/${obraId}/compras`}
            // Criar fornecedor é ação de engenheiro — a ação recusaria.
            permiteCadastrarFornecedor={false}
          />
        </CardContent>
      </Card>
    </div>
  );
}
