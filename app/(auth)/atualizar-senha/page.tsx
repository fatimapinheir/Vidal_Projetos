import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { UpdatePasswordForm } from "./update-password-form";

export default function AtualizarSenhaPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Defina sua senha</CardTitle>
        <CardDescription>
          Escolha uma senha para acessar sua obra no Vidal Projetos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <UpdatePasswordForm />
      </CardContent>
    </Card>
  );
}
