"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Abrir a folha de outro dia — para lançar um diário atrasado ou reler um
 * antigo. Não cria nada no banco: só navega para a data, e a folha nasce quando
 * o diário é salvo.
 */
export function AbrirDiaForm({ obraId }: { obraId: string }) {
  const [data, setData] = useState("");
  const router = useRouter();

  function handleSubmit(evento: React.FormEvent) {
    evento.preventDefault();
    if (data) router.push(`/obras/${obraId}/diario/${data}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        type="date"
        value={data}
        onChange={(e) => setData(e.target.value)}
        aria-label="Abrir diário de outra data"
        className="w-40"
      />
      <Button type="submit" variant="outline" disabled={!data}>
        Abrir
      </Button>
    </form>
  );
}
