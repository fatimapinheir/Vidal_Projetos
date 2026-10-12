import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

/**
 * Traduz o que o Supabase devolve nos links de e-mail. A mensagem original vem
 * em inglês e não diz o que fazer — e o caso de longe mais comum (link expirado
 * ou já usado) tem uma causa que não é óbvia: leitores de e-mail e antivírus
 * abrem os links sozinhos para checar se são seguros, e como o link é de uso
 * único, ele já chega gasto.
 */
function mensagemDeErro(erro: string): string {
  const bruto = erro.toLowerCase();

  if (bruto.includes("expired") || bruto.includes("invalid") || erro === "link_invalido") {
    return "Esse link de e-mail não vale mais — ele é de uso único e expira. Vale saber que alguns leitores de e-mail e antivírus abrem os links sozinhos para checar segurança, e isso já consome o link antes de você clicar. Peça um novo e abra-o assim que chegar.";
  }
  if (erro === "link_incompleto") {
    return "O link veio incompleto e não deu para abrir a sessão. Peça um novo link.";
  }
  return erro;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;

  return (
    // A chapa navy ao lado já mostra a marca; repetir "Ankora" no título
    // deixaria o nome duas vezes na mesma dobra.
    <Card className="w-full border-0 shadow-none sm:border sm:shadow-sm">
      <CardHeader>
        <CardTitle className="font-heading text-2xl">Acesse sua conta</CardTitle>
        <CardDescription>Entre para acompanhar o andamento da sua obra.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {erro && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {mensagemDeErro(erro)}
          </p>
        )}
        <LoginForm />
      </CardContent>
    </Card>
  );
}
