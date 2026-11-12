"use client";

import { useState, useTransition, useActionState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Building2, HardHat, KeyRound, LogOut, Repeat, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/lib/auth/actions";
import {
  trocarPerfilAction,
  alterarSenhaAction,
  definirObraPadraoAction,
  obrasParaPadrao,
  type ContaFormState,
} from "@/app/actions/conta";
import type { UserRole } from "@/lib/types/database.types";

const ROTULO_PAPEL: Record<UserRole, string> = {
  engenheiro: "Engenheiro",
  cliente: "Cliente",
};

const initialState: ContaFormState = { error: null };

function Iniciais({ nome }: { nome: string }) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const texto = partes.length
    ? ((partes[0][0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase()
    : "?";
  return (
    <span
      aria-hidden
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
    >
      {texto}
    </span>
  );
}

/**
 * O que abre no ícone do nome: quem eu sou, e o que posso mudar sobre isso.
 *
 * Era um link direto para `/perfil`. Dois problemas com isso, e o segundo é o
 * que doía: `/perfil` vive dentro de `app/(engenheiro)`, cujo layout exige
 * `role = 'engenheiro'` — então para o cliente o ícone levava a um redirect de
 * volta, e ele não tinha lugar nenhum para trocar a própria senha.
 *
 * Agora é um menu, e o que está nele depende de quem abre:
 *
 *   - **Trocar de perfil**, só para quem tem mais de um papel. Não é um
 *     "modo de visualização": troca de verdade, inclusive o que a RLS libera.
 *   - **Obra padrão**, para quem tem o papel de engenheiro — é onde o perfil
 *     de engenheiro passa a abrir.
 *   - **Alterar senha**, para todos, sem passar pela recuperação por email.
 *   - **Meus dados**, só para engenheiro, que é de quem a tela `/perfil` trata.
 */
export function MenuDoUsuario({
  nome,
  role,
  papeis,
  obraPadraoId,
}: {
  nome: string;
  role: UserRole;
  /** Os perfis que esta pessoa pode assumir. Um só = sem seletor. */
  papeis: UserRole[];
  obraPadraoId: string | null;
}) {
  const [senhaAberta, setSenhaAberta] = useState(false);
  const [obraAberta, setObraAberta] = useState(false);
  const [trocando, iniciarTroca] = useTransition();
  const [saindo, iniciarSaida] = useTransition();

  const outros = papeis.filter((p) => p !== role);
  const podeSerEngenheiro = papeis.includes("engenheiro");

  /*
   * Quem tem os dois perfis e ainda não escolheu a obra padrão é PERGUNTADO,
   * em vez de ter que descobrir a opção no menu.
   *
   * Uma vez por sessão do navegador, e só no perfil de engenheiro, que é o
   * perfil cuja entrada a resposta muda. Sem a marca na `sessionStorage` o
   * diálogo reabriria em toda navegação até ele responder — e "Nenhuma" é uma
   * resposta legítima, que não grava nada e reabriria para sempre.
   *
   * `sessionStorage` pode lançar (janela privada, site com dados bloqueados),
   * e nesse caso a conta é: melhor não perguntar do que derrubar a moldura.
   */
  const precisaEscolherObra = papeis.length > 1 && role === "engenheiro" && !obraPadraoId;

  useEffect(() => {
    if (!precisaEscolherObra) return;
    try {
      if (sessionStorage.getItem("obra-padrao-perguntada") === "1") return;
      sessionStorage.setItem("obra-padrao-perguntada", "1");
    } catch {
      return;
    }
    /*
     * `setState` dentro de efeito, e a regra do lint está certa em geral — mas
     * esta é a exceção que a própria documentação do React descreve: a decisão
     * vem de um sistema externo (`sessionStorage`) que só existe depois da
     * hidratação. Calcular no inicializador do `useState` seria mais limpo e
     * daria divergência de hidratação, porque o servidor não tem como saber se
     * já perguntamos.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setObraAberta(true);
  }, [precisaEscolherObra]);

  function trocarPara(alvo: UserRole) {
    iniciarTroca(async () => {
      try {
        const r = await trocarPerfilAction(alvo);
        // A ação redireciona quando dá certo; só o erro volta até aqui.
        if (r?.error) toast.error(r.error);
      } catch (err) {
        // `redirect()` funciona lançando: o desvio bem-sucedido passa por aqui.
        if (
          typeof err === "object" &&
          err !== null &&
          "digest" in err &&
          String((err as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
        ) {
          throw err;
        }
        toast.error(err instanceof Error ? err.message : "Não foi possível trocar de perfil.");
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="rounded-full transition-opacity hover:opacity-85"
          aria-label={`${nome} — ${ROTULO_PAPEL[role]}`}
        >
          <Iniciais nome={nome} />
        </DropdownMenuTrigger>

        <DropdownMenuPortal>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="truncate font-medium">{nome}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {ROTULO_PAPEL[role]}
                {papeis.length > 1 && " · perfil ativo"}
              </span>
            </DropdownMenuLabel>

            {outros.length > 0 && (
              <>
                <DropdownMenuSeparator />
                {outros.map((alvo) => (
                  <DropdownMenuItem
                    key={alvo}
                    disabled={trocando}
                    onClick={() => trocarPara(alvo)}
                  >
                    {alvo === "engenheiro" ? (
                      <HardHat className="size-4" aria-hidden />
                    ) : (
                      <Users className="size-4" aria-hidden />
                    )}
                    {trocando ? "Trocando..." : `Entrar como ${ROTULO_PAPEL[alvo]}`}
                  </DropdownMenuItem>
                ))}
              </>
            )}

            <DropdownMenuSeparator />

            {podeSerEngenheiro && (
              <DropdownMenuItem onClick={() => setObraAberta(true)}>
                <Building2 className="size-4" aria-hidden />
                Obra padrão
              </DropdownMenuItem>
            )}

            <DropdownMenuItem onClick={() => setSenhaAberta(true)}>
              <KeyRound className="size-4" aria-hidden />
              Alterar senha
            </DropdownMenuItem>

            {role === "engenheiro" && (
              <DropdownMenuItem render={<Link href="/perfil" />} nativeButton={false}>
                <User className="size-4" aria-hidden />
                Meus dados
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              disabled={saindo}
              onClick={() => iniciarSaida(() => logout())}
            >
              <LogOut className="size-4" aria-hidden />
              {saindo ? "Saindo..." : "Sair"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenu>

      <DialogSenha aberta={senhaAberta} aoFechar={() => setSenhaAberta(false)} />
      {podeSerEngenheiro && (
        <DialogObraPadrao
          aberta={obraAberta}
          aoFechar={() => setObraAberta(false)}
          obraPadraoId={obraPadraoId}
          perguntando={precisaEscolherObra}
        />
      )}
    </>
  );
}

function DialogSenha({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  const [state, formAction, pending] = useActionState(alterarSenhaAction, initialState);

  useEffect(() => {
    if (state.ok) {
      toast.success("Senha alterada.");
      aoFechar();
    }
    // `aoFechar` muda de identidade a cada render do pai; incluí-lo reabriria
    // o efeito sem necessidade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  return (
    <Dialog open={aberta} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar senha</DialogTitle>
          <DialogDescription>
            A senha atual é pedida para confirmar que é você — sem ela, quem alcançasse este
            navegador já logado trocaria a senha e tomaria a conta.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="senha_atual">Senha atual</FieldLabel>
              <Input
                id="senha_atual"
                name="senha_atual"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="senha_nova">Senha nova</FieldLabel>
              <Input
                id="senha_nova"
                name="senha_nova"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
              <FieldDescription>Ao menos 8 caracteres.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="senha_confirmacao">Repita a senha nova</FieldLabel>
              <Input
                id="senha_confirmacao"
                name="senha_confirmacao"
                type="password"
                autoComplete="new-password"
                required
              />
            </Field>

            {state.error && <FieldError>{state.error}</FieldError>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={aoFechar} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Alterando..." : "Alterar senha"}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Em que obra o perfil de engenheiro abre.
 *
 * As obras são buscadas quando o diálogo ABRE, e não junto da moldura: a lista
 * só interessa a quem veio mudar isso, e carregá-la em toda navegação custaria
 * uma consulta por tela para um menu que quase nunca se abre.
 */
function DialogObraPadrao({
  aberta,
  aoFechar,
  obraPadraoId,
  perguntando = false,
}: {
  aberta: boolean;
  aoFechar: () => void;
  obraPadraoId: string | null;
  /** Abriu sozinho, porque ele tem dois perfis e ainda não respondeu. */
  perguntando?: boolean;
}) {
  const [obras, setObras] = useState<{ id: string; nome: string }[] | null>(null);
  const [escolhida, setEscolhida] = useState(obraPadraoId ?? "");
  const [salvando, iniciarSalvar] = useTransition();

  useEffect(() => {
    if (!aberta || obras !== null) return;
    void obrasParaPadrao().then(setObras);
  }, [aberta, obras]);

  function salvar() {
    iniciarSalvar(async () => {
      const r = await definirObraPadraoAction(escolhida || null);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(
        escolhida ? "Obra padrão definida." : "Obra padrão removida: volta a abrir no Dashboard."
      );
      aoFechar();
    });
  }

  return (
    <Dialog open={aberta} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Obra padrão</DialogTitle>
          <DialogDescription>
            {perguntando
              ? "Você tem dois perfis. Escolha em qual obra o perfil de engenheiro deve abrir — você entra direto na visão geral dela. Pode deixar em branco e definir depois, neste mesmo menu."
              : "É nela que o perfil de engenheiro abre, direto na visão geral. Sem obra padrão, a entrada é no Dashboard de todas as obras."}
          </DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel htmlFor="obra_padrao">Obra</FieldLabel>
          <select
            id="obra_padrao"
            value={escolhida}
            onChange={(e) => setEscolhida(e.target.value)}
            disabled={obras === null}
            className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="">{obras === null ? "Carregando..." : "Nenhuma (abrir no Dashboard)"}</option>
            {(obras ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        </Field>

        <DialogFooter>
          <Button variant="outline" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando || obras === null}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** O ícone de troca, para reaproveitar em avisos fora do menu. */
export const IconeTrocaDePerfil = Repeat;
