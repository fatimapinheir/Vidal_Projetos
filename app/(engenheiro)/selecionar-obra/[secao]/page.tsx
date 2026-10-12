import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { acharSecaoPorSlug, caminhoDaSecao } from "@/lib/obra-secoes";
import { formatarEndereco } from "@/lib/obra-cadastro";

const statusLabel: Record<string, string> = {
  planejamento: "Planejamento",
  em_andamento: "Em andamento",
  pausada: "Pausada",
  concluida: "Concluída",
};

/**
 * Escolha da obra antes de abrir uma seção.
 *
 * Só aparece quando o sistema ainda não sabe em que obra você estava — na
 * primeira visita, ou depois de limpar os cookies. A partir daí a lateral
 * aponta direto para a última obra aberta e esta tela sai do caminho.
 */
export default async function SelecionarObraPage({
  params,
}: {
  params: Promise<{ secao: string }>;
}) {
  const { secao: slug } = await params;
  const secao = acharSecaoPorSlug(slug);
  if (!secao) notFound();

  const supabase = await createClient();
  const { data: obras } = await supabase
    .from("obras")
    .select("id, nome, status, logradouro, numero, complemento, bairro, cidade, uf")
    .order("nome");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div>
        <h1 className="font-heading text-lg font-semibold">{secao.label}</h1>
        <p className="text-sm text-muted-foreground">
          Escolha a obra para ver {secao.label.toLowerCase()}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Suas obras</CardTitle>
          <CardDescription>
            A obra escolhida fica guardada — nas próximas vezes o menu já abre nela.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {obras?.map((obra) => (
            <Link
              key={obra.id}
              href={caminhoDaSecao(obra.id, secao)}
              className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm transition-colors hover:border-primary/30 hover:bg-accent/50"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{obra.nome}</span>
                  <span className="block truncate text-muted-foreground">
                    {formatarEndereco(obra) ?? "Sem endereço"}
                  </span>
                </span>
              </span>
              <Badge variant="secondary">{statusLabel[obra.status]}</Badge>
            </Link>
          ))}

          {!obras?.length && (
            <div className="flex flex-col items-start gap-3 py-4">
              <p className="text-sm text-muted-foreground">
                Nenhuma obra cadastrada ainda. Cadastre a primeira para começar a usar esta tela.
              </p>
              <Button
                size="sm"
                nativeButton={false}
                render={<Link href="/obras/novo">Nova obra</Link>}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
