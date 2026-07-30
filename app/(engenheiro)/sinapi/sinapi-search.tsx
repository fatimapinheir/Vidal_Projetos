"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { buscarSinapi } from "@/app/actions/sinapi";

type Resultado = { id: string; codigo: string; descricao: string; unidade: string; preco_unitario: number };

export function SinapiSearch() {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [pending, startTransition] = useTransition();

  function handleChange(value: string) {
    setTermo(value);
    if (value.trim().length < 2) {
      setResultados([]);
      return;
    }
    startTransition(async () => {
      setResultados(await buscarSinapi(value));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder="Buscar por código ou descrição..."
        value={termo}
        onChange={(e) => handleChange(e.target.value)}
      />
      {termo.trim().length >= 2 && (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Un.</TableHead>
                <TableHead>Preço unit.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resultados.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-xs">{item.codigo}</TableCell>
                  <TableCell>{item.descricao}</TableCell>
                  <TableCell>{item.unidade}</TableCell>
                  <TableCell>
                    {item.preco_unitario.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </TableCell>
                </TableRow>
              ))}
              {!pending && !resultados.length && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Nenhum item encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
