"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { criarFuncao, salvarEfetivoDaFuncao } from "@/app/actions/funcoes";

export type FuncaoOpcao = { id: string; nome: string };
export type LinhaEfetivoFuncao = { funcaoId: string; funcao: string; quantidade: number };

const CADASTRAR = "__cadastrar__";

/**
 * O efetivo do dia, contado por função.
 *
 * Responde a pergunta que se faz olhando uma frente de serviço: quantos de
 * cada função estavam lá. A lista por nome, que havia antes, só enxergava quem
 * estava CADASTRADO e alocado — e o caso comum é o oposto: a equipe chega com
 * três pessoas e só o responsável está no cadastro. O efetivo do dia não é a
 * folha de funcionários da empresa; é quem pisou na obra naquele dia.
 *
 * Por isso a quantidade é digitada, e não deduzida de presença lançada. As
 * duas coisas convivem: a presença individual continua existindo porque é dela
 * que sai o cálculo de diária no fechamento de folha.
 */
export function EfetivoPorFuncao({
  obraId,
  data,
  responsaveis,
  linhas,
  funcoes,
  somenteLeitura,
}: {
  obraId: string;
  data: string;
  /** Vem do cadastro de equipe — muda quando a equipe da obra muda. */
  responsaveis: string[];
  linhas: LinhaEfetivoFuncao[];
  /** Todas as funções cadastradas, para o seletor. */
  funcoes: FuncaoOpcao[];
  somenteLeitura: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [cadastrando, setCadastrando] = useState(false);
  const [nomeNovo, setNomeNovo] = useState("");

  const jaNaFolha = new Set(linhas.map((l) => l.funcaoId));
  const disponiveis = funcoes.filter((f) => !jaNaFolha.has(f.id));
  const total = linhas.reduce((soma, l) => soma + l.quantidade, 0);

  function salvar(funcaoId: string, quantidade: number) {
    iniciar(async () => {
      const resultado = await salvarEfetivoDaFuncao(obraId, data, funcaoId, quantidade);
      if (resultado.error) {
        toast.error(resultado.error);
        return;
      }
      router.refresh();
    });
  }

  function cadastrarEAdicionar() {
    iniciar(async () => {
      const resultado = await criarFuncao(nomeNovo);
      if (resultado.error || !resultado.funcaoId) {
        toast.error(resultado.error ?? "Não foi possível cadastrar a função.");
        return;
      }
      // Entra na folha já com uma pessoa: quem cadastra uma função no meio do
      // preenchimento do dia é porque ela esteve na obra.
      const salvou = await salvarEfetivoDaFuncao(obraId, data, resultado.funcaoId, 1);
      if (salvou.error) {
        toast.error(salvou.error);
        return;
      }
      setNomeNovo("");
      setCadastrando(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {!!responsaveis.length && (
        <div className="rounded-lg bg-muted/50 px-2.5 py-2">
          <p className="text-xs text-muted-foreground">
            {responsaveis.length === 1 ? "Responsável pela equipe" : "Responsáveis pelas equipes"}
          </p>
          <p className="font-medium">{responsaveis.join(", ")}</p>
        </div>
      )}

      {linhas.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-2.5 py-1.5 text-left font-semibold">Função</th>
                <th className="w-20 px-2.5 py-1.5 text-right font-semibold">Qtd.</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha) => (
                <tr key={linha.funcaoId} className="border-t">
                  <td className="truncate px-2.5 py-1.5" title={linha.funcao}>
                    {linha.funcao}
                  </td>
                  <td className="px-1 py-1">
                    {somenteLeitura ? (
                      <p className="pr-1.5 text-right tabular-nums">{linha.quantidade}</p>
                    ) : (
                      /*
                        Salva ao sair do campo, como a legenda da foto e os
                        campos extras da folha. Um botão por linha numa tabela
                        de seis funções é mais ruído que ajuda.
                      */
                      <Input
                        type="number"
                        min={0}
                        max={999}
                        step={1}
                        defaultValue={linha.quantidade}
                        disabled={pendente}
                        aria-label={`Quantidade de ${linha.funcao}`}
                        onBlur={(e) => {
                          const valor = Number(e.target.value);
                          if (!Number.isFinite(valor) || valor === linha.quantidade) return;
                          salvar(linha.funcaoId, valor);
                        }}
                        className="h-8 text-right tabular-nums"
                      />
                    )}
                  </td>
                  <td className="px-1 text-right">
                    {!somenteLeitura && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={pendente}
                        aria-label={`Tirar ${linha.funcao} da folha`}
                        title="Tirar da folha"
                        onClick={() => salvar(linha.funcaoId, 0)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t bg-muted/40 font-medium">
              <tr>
                <td className="px-2.5 py-1.5">Total em obra</td>
                <td className="px-2.5 py-1.5 text-right tabular-nums">{total}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {!somenteLeitura && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value=""
            disabled={pendente}
            aria-label="Adicionar função à folha do dia"
            onChange={(e) => {
              const escolhido = e.target.value;
              if (!escolhido) return;
              if (escolhido === CADASTRAR) return setCadastrando(true);
              // Entra com uma pessoa; a quantidade se ajusta no campo.
              salvar(escolhido, 1);
            }}
            className="h-8 min-w-44 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm disabled:opacity-60"
          >
            <option value="">Selecione uma função...</option>
            {disponiveis.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
            {/* "Cadastrar" dentro do próprio seletor: quem percebe que falta
                uma função percebe no momento de escolhê-la. */}
            <option value={CADASTRAR}>+ Cadastrar função...</option>
          </select>
        </div>
      )}

      {!linhas.length && somenteLeitura && (
        <p className="text-muted-foreground">Nenhum efetivo lançado nesse dia.</p>
      )}

      {/* Sem gatilho: quem abre é a opção "+ Cadastrar função" do seletor
          acima, e um gatilho escondido só entraria na ordem de tabulação. */}
      <Dialog open={cadastrando} onOpenChange={setCadastrando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar função</DialogTitle>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="nova-funcao">Nome da função</FieldLabel>
            <Input
              id="nova-funcao"
              value={nomeNovo}
              onChange={(e) => setNomeNovo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && nomeNovo.trim().length >= 2) {
                  e.preventDefault();
                  cadastrarEAdicionar();
                }
              }}
              placeholder="Armador, encanador, eletricista..."
              autoFocus
            />
            <FieldDescription>
              Fica disponível em todas as obras. Já cadastrada, a existente é reaproveitada.
            </FieldDescription>
          </Field>
          <Button
            type="button"
            onClick={cadastrarEAdicionar}
            disabled={pendente || nomeNovo.trim().length < 2}
          >
            <Plus className="size-4" />
            {pendente ? "Cadastrando..." : "Cadastrar e lançar na folha"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
