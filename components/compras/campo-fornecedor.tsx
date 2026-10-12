"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field";
import { ComboBusca } from "@/components/ui/combo-busca";
import { criarFornecedorRapido } from "@/app/actions/fornecedores";

export type FornecedorOpcao = { id: string; nome: string };

/**
 * Escolha do fornecedor, com cadastro mínimo na hora.
 *
 * O diálogo pede só o nome — o cadastro completo tem tela própria. Quem está
 * preenchendo uma ordem de compra não quer parar para digitar CNPJ e contatos;
 * quer que o fornecedor exista para seguir adiante.
 */
export function CampoFornecedor({
  fornecedores: iniciais,
  valorInicial = "",
  permiteCadastrar = true,
}: {
  fornecedores: FornecedorOpcao[];
  valorInicial?: string;
  /**
   * Desligado na tela do cliente: criar fornecedor é ação de engenheiro, e a
   * ação recusaria — oferecer o botão só para o clique falhar é pior que não
   * oferecer.
   */
  permiteCadastrar?: boolean;
}) {
  const [fornecedores, setFornecedores] = useState(iniciais);
  const [selecionado, setSelecionado] = useState(valorInicial);
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [criando, iniciar] = useTransition();

  function criar() {
    setErro(null);
    iniciar(async () => {
      const r = await criarFornecedorRapido(nome);
      if (r.error || !r.criadoId) {
        setErro(r.error ?? "Não foi possível criar o fornecedor.");
        return;
      }
      setFornecedores((atuais) =>
        [...atuais, { id: r.criadoId!, nome: nome.trim() }].sort((a, b) =>
          a.nome.localeCompare(b.nome, "pt-BR")
        )
      );
      setSelecionado(r.criadoId);
      setAberto(false);
      toast.success("Fornecedor criado.");
    });
  }

  return (
    <>
      <ComboBusca
        name="fornecedor_id"
        required
        opcoes={fornecedores.map((f) => ({ valor: f.id, rotulo: f.nome }))}
        valor={selecionado}
        aoMudar={setSelecionado}
        placeholder="Escolha o fornecedor"
        rotuloCadastrar="Cadastrar"
        aoCadastrar={
          permiteCadastrar
            ? (texto) => {
                setNome(texto);
                setAberto(true);
              }
            : undefined
        }
      />

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo fornecedor</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="nome_fornecedor_rapido">Nome</FieldLabel>
              <Input
                id="nome_fornecedor_rapido"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome do fornecedor"
              />
              <FieldDescription>
                CNPJ, contatos e condição de pagamento você completa depois, em Fornecedores.
              </FieldDescription>
            </Field>

            {erro && <FieldError>{erro}</FieldError>}

            <div className="flex gap-2">
              <Button type="button" onClick={criar} disabled={criando}>
                {criando ? "Criando..." : "Criar fornecedor"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
