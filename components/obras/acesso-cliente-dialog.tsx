"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
  FieldDescription,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { criarClienteParaObra } from "@/app/actions/obra-clientes";
import { formatarDocumento, rotuloDocumento, type TipoPessoa } from "@/lib/documento";

/**
 * Dá acesso ao portal para o cliente da obra.
 *
 * Abre logo depois de a obra ser criada, que é quando a informação está na
 * cabeça de quem cadastrou. Antes disso o vínculo morava dentro do diálogo
 * "Editar obra" — lugar onde ninguém procura por "cadastrar cliente".
 *
 * Dá para pular: existe obra sem cliente no portal (obra própria, ou cliente
 * que ainda não vai receber acesso), e o vínculo continua disponível depois
 * pela tela da obra.
 */
export function AcessoClienteDialog({
  obraId,
  aberto,
  onFechar,
}: {
  obraId: string;
  aberto: boolean;
  onFechar: () => void;
}) {
  const [tipo, setTipo] = useState<TipoPessoa>("pf");
  const [documento, setDocumento] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();

  async function enviar(formData: FormData) {
    setEnviando(true);
    setErro(null);
    const r = await criarClienteParaObra(obraId, { error: null }, formData);
    setEnviando(false);

    if (!r.success) {
      setErro(r.error ?? "Não foi possível criar o acesso.");
      return;
    }
    // O aviso cobre os casos em que deu certo mas não do jeito esperado:
    // cliente que já existia, ou e-mail que não saiu. Vai como toast porque o
    // diálogo fecha.
    toast[r.aviso ? "warning" : "success"](
      r.aviso ?? "Cliente cadastrado. O e-mail para definir a senha foi enviado."
    );
    onFechar();
    router.refresh();
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dar acesso ao cliente</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          O cliente recebe um e-mail para criar a própria senha e passa a acompanhar esta obra pelo
          portal. Você não define a senha dele.
        </p>

        <form action={enviar}>
          <FieldGroup>
            <FieldSet>
              <FieldLegend variant="label">Tipo de pessoa</FieldLegend>
              <Field orientation="horizontal">
                {(["pf", "pj"] as const).map((valor) => (
                  <label key={valor} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="tipo_pessoa"
                      value={valor}
                      checked={tipo === valor}
                      onChange={() => {
                        setTipo(valor);
                        // O documento já digitado não serve para o outro tipo:
                        // a máscara e a quantidade de dígitos mudam.
                        setDocumento("");
                      }}
                    />
                    {valor === "pf" ? "Pessoa física" : "Pessoa jurídica"}
                  </label>
                ))}
              </Field>
            </FieldSet>

            <Field>
              <FieldLabel htmlFor="cliente-nome">
                {tipo === "pf" ? "Nome completo" : "Razão social"}
              </FieldLabel>
              <Input id="cliente-nome" name="nome" required />
            </Field>

            <Field orientation="responsive">
              <div className="w-full">
                <FieldLabel htmlFor="cliente-email">E-mail</FieldLabel>
                <Input id="cliente-email" name="email" type="email" required />
                <FieldDescription>É por ele que o cliente entra no portal.</FieldDescription>
              </div>
              <div className="w-full">
                <FieldLabel htmlFor="cliente-telefone">Telefone</FieldLabel>
                <Input id="cliente-telefone" name="telefone" />
              </div>
            </Field>

            <Field>
              {/* Um campo só, que troca de rótulo e máscara conforme o tipo —
                  nunca os dois ao mesmo tempo. */}
              <FieldLabel htmlFor="cliente-documento">{rotuloDocumento(tipo)}</FieldLabel>
              <Input
                id="cliente-documento"
                name="cpf_cnpj"
                inputMode="numeric"
                className="max-w-56"
                placeholder={tipo === "pf" ? "000.000.000-00" : "00.000.000/0000-00"}
                value={documento}
                onChange={(e) => setDocumento(formatarDocumento(tipo, e.target.value))}
              />
            </Field>

            {erro && <FieldError>{erro}</FieldError>}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={enviando}>
                {enviando ? "Criando acesso..." : "Criar acesso e enviar e-mail"}
              </Button>
              <Button type="button" variant="ghost" onClick={onFechar} disabled={enviando}>
                Pular por enquanto
              </Button>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
