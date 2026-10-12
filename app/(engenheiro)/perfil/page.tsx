import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { PerfilForm } from "./perfil-form";
import { AssinaturaUpload } from "./assinatura-upload";
import { LogoUpload } from "./logo-upload";

export default async function PerfilPage() {
  const profile = await requireRole("engenheiro");
  const supabase = await createClient();

  const { data: dados } = await supabase
    .from("profiles")
    .select("nome, telefone, email, crea, assinatura_path, logo_path")
    .eq("id", profile.id)
    .single();

  // URL assinada: o bucket é privado, a imagem é dado pessoal.
  let assinaturaUrl: string | null = null;
  if (dados?.assinatura_path) {
    const { data } = await supabase.storage
      .from("assinaturas")
      .createSignedUrl(dados.assinatura_path, 60 * 10);
    assinaturaUrl = data?.signedUrl ?? null;
  }

  // A logo, ao contrário da assinatura, mora em bucket público: é marca, não
  // documento, e URL que expira só criaria link morto na tela do cliente.
  const logoUrl = dados?.logo_path
    ? supabase.storage.from("logos").getPublicUrl(dados.logo_path).data.publicUrl
    : null;

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="font-heading text-lg font-semibold">Meu cadastro</h1>
        <p className="text-sm text-muted-foreground">
          Estes dados vão para o cabeçalho e a assinatura do relatório diário de obra.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do responsável técnico</CardTitle>
        </CardHeader>
        <CardContent>
          <PerfilForm
            inicial={{
              nome: dados?.nome ?? "",
              telefone: dados?.telefone ?? "",
              crea: dados?.crea ?? "",
              email: dados?.email ?? "",
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logo da empresa</CardTitle>
          <CardDescription>
            A marca que aparece no topo do menu — na sua tela e na dos seus clientes no portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LogoUpload urlAtual={logoUrl} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assinatura</CardTitle>
          <CardDescription>
            Imagem da sua assinatura, usada no relatório diário. Use fundo branco ou transparente —
            ela é impressa sobre a linha de assinatura.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AssinaturaUpload urlAtual={assinaturaUrl} />
        </CardContent>
      </Card>
    </div>
  );
}
