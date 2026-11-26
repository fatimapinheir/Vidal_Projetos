import { Suspense } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";
import { AvisoDeErro } from "./aviso-de-erro";
import { AquecerServidor } from "./aquecer-servidor";

/**
 * Esta página é ESTÁTICA de propósito, e precisa continuar sendo.
 *
 * Ela lia `searchParams` no servidor para exibir o erro de link de e-mail. Só
 * que tocar em `searchParams` obriga o Next a renderizar a página a cada
 * visita, e isso fazia a porta de entrada do sistema acordar a função Node:
 * 5,2s de TTFB medidos em produção (4,76s só de partida a frio), contra ~210ms
 * com a função quente. Tudo isso para, na esmagadora maioria das visitas, não
 * mostrar erro nenhum.
 *
 * Quem lê o `?erro=` agora é `AvisoDeErro`, no navegador. O `Suspense` em volta
 * não é enfeite: sem ele, `useSearchParams` derruba a página inteira de volta
 * para renderização dinâmica e o problema volta sem avisar.
 *
 * `AquecerServidor` cuida da outra metade — sendo estática, a página não acorda
 * mais a função, então a espera migraria para o clique em "Entrar". Ver
 * `app/api/aquecer/route.ts`.
 *
 * Se algum dia for preciso ler algo do servidor aqui, confira depois que
 * `/login` continua saindo como estática no build. O sintoma de regressão é
 * silencioso: nada quebra, a porta de entrada só fica cinco segundos mais lenta.
 */
export default function LoginPage() {
  return (
    // A chapa navy ao lado já mostra a marca; repetir "Ankora" no título
    // deixaria o nome duas vezes na mesma dobra.
    <Card className="w-full border-0 shadow-none sm:border sm:shadow-sm">
      <CardHeader>
        <CardTitle className="font-heading text-2xl">Acesse sua conta</CardTitle>
        <CardDescription>Entre para acompanhar o andamento da sua obra.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Suspense fallback={null}>
          <AvisoDeErro />
        </Suspense>
        <LoginForm />
      </CardContent>
      <AquecerServidor />
    </Card>
  );
}
