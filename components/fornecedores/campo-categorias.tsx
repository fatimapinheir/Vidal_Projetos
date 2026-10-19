"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldDescription, FieldLabel } from "@/components/ui/field";
import { criarCategoriaFornecedor } from "@/app/actions/fornecedores";

export type CategoriaFornecedor = {
  id: string;
  nome: string;
  tipo: "material" | "servico";
};

const classeSelect = "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm";

/**
 * O que o fornecedor vende ou presta.
 *
 * Várias de uma vez, porque é o caso comum: a mesma loja vende ferragem e
 * material hidráulico, e um empreiteiro faz alvenaria e reboco. Um seletor de
 * escolha única obrigaria a marcar a categoria "mais ou menos certa" e perder
 * o resto — e é justamente pelo resto que se procura fornecedor.
 *
 * As marcadas vão como `categoria_id` repetido no formulário, que é como o
 * navegador manda caixas de seleção de mesmo nome.
 *
 * O tipo (material ou serviço) vem da CATEGORIA, não do fornecedor. Assim quem
 * vende material e também presta serviço simplesmente marca categorias dos
 * dois tipos, sem um campo separado que possa contradizer as categorias.
 */
export function CampoCategorias({
  categorias: categoriasIniciais,
  marcadas: marcadasIniciais = [],
}: {
  categorias: CategoriaFornecedor[];
  marcadas?: string[];
}) {
  const [categorias, setCategorias] = useState(categoriasIniciais);
  const [marcadas, setMarcadas] = useState<string[]>(marcadasIniciais);
  const [cadastrando, setCadastrando] = useState(false);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"material" | "servico">("material");
  const [pendente, iniciar] = useTransition();

  function alternar(id: string) {
    setMarcadas((atuais) =>
      atuais.includes(id) ? atuais.filter((c) => c !== id) : [...atuais, id]
    );
  }

  function cadastrar() {
    iniciar(async () => {
      const resultado = await criarCategoriaFornecedor(nome, tipo);
      if (resultado.error || !resultado.categoriaId) {
        toast.error(resultado.error ?? "Não foi possível cadastrar a categoria.");
        return;
      }
      const id = resultado.categoriaId;
      // Entra na lista local e já marcada: quem cadastra uma categoria no meio
      // do cadastro do fornecedor é porque ela se aplica a ele.
      setCategorias((atuais) =>
        atuais.some((c) => c.id === id) ? atuais : [...atuais, { id, nome: nome.trim(), tipo }]
      );
      setMarcadas((atuais) => (atuais.includes(id) ? atuais : [...atuais, id]));
      setNome("");
      setCadastrando(false);
    });
  }

  const porTipo = (t: "material" | "servico") => categorias.filter((c) => c.tipo === t);

  return (
    <div className="flex flex-col gap-2">
      <FieldLabel>O que fornece</FieldLabel>

      {marcadas.map((id) => (
        <input key={id} type="hidden" name="categoria_id" value={id} />
      ))}

      {(["material", "servico"] as const).map((t) => (
        <div key={t} className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            {t === "material" ? "Materiais" : "Serviços"}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {porTipo(t).map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-1.5 text-sm">
                <Checkbox
                  checked={marcadas.includes(c.id)}
                  onCheckedChange={() => alternar(c.id)}
                />
                {c.nome}
              </label>
            ))}
            {!porTipo(t).length && (
              <span className="text-sm text-muted-foreground">Nenhuma cadastrada.</span>
            )}
          </div>
        </div>
      ))}

      {cadastrando ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg bg-muted/40 p-2.5">
          <div className="flex min-w-48 flex-1 flex-col gap-1">
            <FieldLabel htmlFor="nova-categoria">Nome da categoria</FieldLabel>
            <Input
              id="nova-categoria"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => {
                // Enter aqui NÃO pode enviar o formulário do fornecedor —
                // este campo está dentro dele.
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (nome.trim().length >= 2) cadastrar();
                }
              }}
              placeholder="Vidraçaria, serralheria..."
              className="h-8"
            />
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="novo-tipo">Tipo</FieldLabel>
            <select
              id="novo-tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as "material" | "servico")}
              className={classeSelect}
            >
              <option value="material">Material</option>
              <option value="servico">Serviço</option>
            </select>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={cadastrar}
            disabled={pendente || nome.trim().length < 2}
          >
            {pendente ? "Cadastrando..." : "Cadastrar"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setCadastrando(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-fit"
          onClick={() => setCadastrando(true)}
        >
          <Plus className="size-4" />
          Cadastrar categoria
        </Button>
      )}

      <FieldDescription>
        {marcadas.length
          ? `${marcadas.length} ${marcadas.length === 1 ? "categoria marcada" : "categorias marcadas"}.`
          : "Sem categoria, o fornecedor só aparece na busca por nome."}
      </FieldDescription>
    </div>
  );
}

/** Os selos da listagem. Material e serviço se distinguem pela cor. */
export function SelosDeCategoria({ categorias }: { categorias: CategoriaFornecedor[] }) {
  if (!categorias.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {categorias.map((c) => (
        <Badge key={c.id} variant={c.tipo === "material" ? "secondary" : "outline"}>
          {c.nome}
        </Badge>
      ))}
    </span>
  );
}
