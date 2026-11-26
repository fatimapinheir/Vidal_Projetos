"use client";

import { Fragment, useState, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  definirPermissaoAction,
  definirAdministradorAction,
} from "@/app/actions/permissoes";

type Usuario = {
  id: string;
  nome: string;
  email: string | null;
  administrador: boolean;
};
type ItemCatalogo = {
  acao: string;
  grupo: string;
  rotulo: string;
  descricao: string;
  ordem: number;
};
type Concessao = { usuario_id: string; acao: string };

/** `usuario_id|acao` — chave de busca O(1) numa matriz que redesenha a cada clique. */
const chave = (usuarioId: string, acao: string) => `${usuarioId}|${acao}`;

export function MatrizDePermissoes({
  usuarios,
  catalogo,
  concessoes,
  meuId,
}: {
  usuarios: Usuario[];
  catalogo: ItemCatalogo[];
  concessoes: Concessao[];
  meuId: string;
}) {
  /*
   * Estado local espelhando o servidor, e não só `router.refresh()`.
   *
   * São treze linhas por pessoa; esperar o ir-e-voltar a cada clique faria a
   * chave piscar de volta para a posição antiga antes de assentar. Aqui ela
   * move na hora e só volta atrás se o servidor recusar — e aí com um aviso
   * dizendo o motivo, que vem escrito em português da própria RPC.
   */
  const [marcadas, setMarcadas] = useState(
    () => new Set(concessoes.map((c) => chave(c.usuario_id, c.acao)))
  );
  const [admins, setAdmins] = useState(
    () => new Set(usuarios.filter((u) => u.administrador).map((u) => u.id))
  );
  const [, iniciar] = useTransition();

  /*
   * Quem está aberto na versão de celular. Começa no primeiro que NÃO
   * administra: abrir num administrador mostraria uma lista sem nenhuma chave
   * para mexer, o que parece tela quebrada.
   */
  const [pessoaAberta, setPessoaAberta] = useState(
    () => (usuarios.find((u) => !u.administrador) ?? usuarios[0])?.id ?? ""
  );

  function alternarPermissao(usuarioId: string, acao: string, conceder: boolean) {
    const k = chave(usuarioId, acao);
    setMarcadas((atual) => {
      const proximo = new Set(atual);
      if (conceder) proximo.add(k);
      else proximo.delete(k);
      return proximo;
    });

    iniciar(async () => {
      const { error } = await definirPermissaoAction(usuarioId, acao, conceder);
      if (error) {
        toast.error(error);
        setMarcadas((atual) => {
          const proximo = new Set(atual);
          if (conceder) proximo.delete(k);
          else proximo.add(k);
          return proximo;
        });
      }
    });
  }

  function alternarAdmin(usuarioId: string, virar: boolean) {
    setAdmins((atual) => {
      const proximo = new Set(atual);
      if (virar) proximo.add(usuarioId);
      else proximo.delete(usuarioId);
      return proximo;
    });

    iniciar(async () => {
      const { error } = await definirAdministradorAction(usuarioId, virar);
      if (error) {
        toast.error(error);
        setAdmins((atual) => {
          const proximo = new Set(atual);
          if (virar) proximo.delete(usuarioId);
          else proximo.add(usuarioId);
          return proximo;
        });
      }
    });
  }

  // Agrupa preservando a ordem do catálogo, que já vem ordenada do banco.
  const grupos: { grupo: string; itens: ItemCatalogo[] }[] = [];
  for (const item of catalogo) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.grupo === item.grupo) ultimo.itens.push(item);
    else grupos.push({ grupo: item.grupo, itens: [item] });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Administradores primeiro: é a chave que decide quem mexe nesta tela. */}
      <section className="rounded-lg border p-4">
        <h2 className="font-heading text-lg">Quem administra permissões</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Administrador pode tudo no sistema e decide o que os outros podem. Por isso não aparece
          na lista abaixo — as chaves dele estariam todas ligadas e travadas.
        </p>
        <ul className="mt-4 flex flex-col divide-y">
          {usuarios.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-4 py-2.5">
              {/* `flex-1` junto com `min-w-0`: sem ele o `truncate` não tem
                  largura definida contra a qual cortar, e um nome longo
                  empurrava a chave para fora da tela no celular. */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {u.nome}
                  {u.id === meuId && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">você</span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
              </div>
              <Switch
                checked={admins.has(u.id)}
                onCheckedChange={(v) => alternarAdmin(u.id, v)}
                aria-label={`Administrador: ${u.nome}`}
              />
            </li>
          ))}
        </ul>
      </section>

      {/*
        A matriz existe só a partir de `md`, e isto não é preguiça de layout.
        
        Ela tem 640px de largura mínima. Num telefone de 375px ela rolava para o
        lado — e ao rolar, a primeira coluna (o NOME da permissão) saía de vista.
        A pessoa ficava mexendo numa chave sem ver do que era. Pior: por não ter
        nenhuma dica de que rolava, a tela parecia simplesmente cortada à
        direita, que foi exatamente como o problema chegou relatado.
        
        No celular a mesma informação aparece embaixo, uma pessoa por vez.
      */}
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="p-3 text-left font-medium">Permissão</th>
              {usuarios.map((u) => (
                <th key={u.id} className="w-28 p-3 text-center font-medium">
                  <span className="block truncate">{u.nome.split(" ")[0]}</span>
                  {admins.has(u.id) && (
                    <Badge variant="secondary" className="mt-1 font-normal">
                      admin
                    </Badge>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grupos.map(({ grupo, itens }) => (
              // `Fragment` com key, e não `<>`: o fragmento curto não aceita
              // key, e sem ela o React remonta o grupo inteiro a cada clique.
              <Fragment key={grupo}>
                <tr className="border-b bg-muted/20">
                  <td
                    colSpan={usuarios.length + 1}
                    className="px-3 py-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase"
                  >
                    {grupo}
                  </td>
                </tr>
                {itens.map((item) => (
                  <tr key={item.acao} className="border-b last:border-0">
                    <td className="p-3">
                      <p className="font-medium">{item.rotulo}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.descricao}</p>
                    </td>
                    {usuarios.map((u) =>
                      admins.has(u.id) ? (
                        // Admin passa em tudo sem precisar de linha na tabela.
                        // Mostrar uma chave ligada que não desliga mentiria
                        // sobre o que o clique faz.
                        <td
                          key={u.id}
                          className="p-3 text-center text-muted-foreground"
                          title="Administrador pode tudo"
                        >
                          —
                        </td>
                      ) : (
                        <td key={u.id} className="p-3 text-center">
                          <Switch
                            checked={marcadas.has(chave(u.id, item.acao))}
                            onCheckedChange={(v) => alternarPermissao(u.id, item.acao, v)}
                            aria-label={`${item.rotulo}: ${u.nome}`}
                          />
                        </td>
                      )
                    )}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/*
        Celular: escolhe-se a PESSOA e vê-se a lista de permissões dela.
        
        Uma pessoa por vez em vez de empilhar as três por permissão (que daria
        42 linhas de rolagem) — e é assim que a tarefa realmente acontece:
        "vou ajustar o Ardiles", não "vou ajustar aprovar-compra em todo mundo".
        Nada rola para o lado, e o nome da permissão fica sempre visível ao lado
        da chave.
      */}
      <div className="flex flex-col gap-4 md:hidden">
        <div className="flex flex-wrap gap-2">
          {usuarios.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => setPessoaAberta(u.id)}
              aria-pressed={pessoaAberta === u.id}
              className={
                pessoaAberta === u.id
                  ? "rounded-lg border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                  : "rounded-lg border px-3 py-1.5 text-sm"
              }
            >
              {u.nome.split(" ")[0]}
              {admins.has(u.id) && " · admin"}
            </button>
          ))}
        </div>

        {(() => {
          const u = usuarios.find((x) => x.id === pessoaAberta);
          if (!u) return null;

          if (admins.has(u.id)) {
            return (
              <p className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{u.nome.split(" ")[0]}</span>{" "}
                administra permissões, então pode tudo — não há chaves para ajustar aqui.
                Para mudar isso, desligue a administração dele acima.
              </p>
            );
          }

          return (
            <div className="rounded-lg border">
              {grupos.map(({ grupo, itens }) => (
                <Fragment key={grupo}>
                  <p className="border-b bg-muted/20 px-3 py-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {grupo}
                  </p>
                  {itens.map((item) => (
                    <div
                      key={item.acao}
                      className="flex items-start justify-between gap-3 border-b p-3 last:border-0"
                    >
                      {/* `min-w-0` para o texto poder encolher em vez de
                          empurrar a chave fora da tela. */}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{item.rotulo}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{item.descricao}</p>
                      </div>
                      <Switch
                        checked={marcadas.has(chave(u.id, item.acao))}
                        onCheckedChange={(v) => alternarPermissao(u.id, item.acao, v)}
                        aria-label={`${item.rotulo}: ${u.nome}`}
                        className="mt-0.5 shrink-0"
                      />
                    </div>
                  ))}
                </Fragment>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
