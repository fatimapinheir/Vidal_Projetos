"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field";
import { ComboBusca } from "@/components/ui/combo-busca";
import { criarCategoria } from "@/app/actions/categorias";

export type Categoria = { id: string; nome: string; tipo_item: string | null };

const ROTULO_TIPO: Record<string, string> = {
  material: "Material",
  servico: "Serviço",
  mao_de_obra: "Mão de obra",
};

/**
 * Escolha da categoria financeira, com cadastro na hora.
 *
 * A lista chega do servidor e vive em estado local a partir daí: a categoria
 * recém-criada precisa aparecer já escolhida, e esperar um `router.refresh()`
 * para isso descartaria o resto do formulário.
 */
export function CampoCategoria({
  categorias: iniciais,
  valorInicial = "",
}: {
  categorias: Categoria[];
  valorInicial?: string;
}) {
  const [categorias, setCategorias] = useState(iniciais);
  const [selecionada, setSelecionada] = useState(valorInicial);
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [criando, iniciar] = useTransition();

  /*
   * Cadastro por transição, não por `useActionState`.
   *
   * Com `useActionState` a resposta chega num estado, e reagir a ela exigia
   * um `useEffect` com `setState` dentro — renderização em cascata, e o lint
   * reclama com razão. Aqui a resposta é o retorno da própria chamada: dá
   * para inserir na lista, selecionar e fechar o diálogo em sequência.
   */
  function criar() {
    setErro(null);
    const formData = new FormData();
    formData.set("nome", nome);
    if (tipo) formData.set("tipo_item", tipo);

    iniciar(async () => {
      const r = await criarCategoria({ error: null }, formData);
      if (r.error || !r.criadaId) {
        setErro(r.error ?? "Não foi possível criar a categoria.");
        return;
      }
      setCategorias((atuais) =>
        [...atuais, { id: r.criadaId!, nome: nome.trim(), tipo_item: tipo || null }].sort((a, b) =>
          a.nome.localeCompare(b.nome, "pt-BR")
        )
      );
      setSelecionada(r.criadaId);
      setAberto(false);
      toast.success("Categoria criada.");
    });
  }

  return (
    <>
      <ComboBusca
        name="categoria_id"
        opcoes={categorias.map((c) => ({
          valor: c.id,
          rotulo: c.nome,
          detalhe: c.tipo_item ? ROTULO_TIPO[c.tipo_item] : undefined,
        }))}
        valor={selecionada}
        aoMudar={setSelecionada}
        placeholder="Escolha a categoria"
        rotuloCadastrar="Criar categoria"
        aoCadastrar={(texto) => {
          setNome(texto);
          setAberto(true);
        }}
      />

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova categoria</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="nome_categoria">Nome</FieldLabel>
              <Input
                id="nome_categoria"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="IPTU, Água, Projetos..."
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="tipo_item_categoria">Entra no orçamento como</FieldLabel>
              <select
                id="tipo_item_categoria"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Não entra</option>
                <option value="material">Material</option>
                <option value="servico">Serviço</option>
                <option value="mao_de_obra">Mão de obra</option>
              </select>
              <FieldDescription>
                Define em qual frente o gasto entra no comparativo com o orçamento. Despesas
                como IPTU e água normalmente não entram.
              </FieldDescription>
            </Field>

            {erro && <FieldError>{erro}</FieldError>}

            <div className="flex gap-2">
              <Button type="button" onClick={criar} disabled={criando}>
                {criando ? "Criando..." : "Criar categoria"}
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
