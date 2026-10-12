"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { UNIDADES } from "@/lib/orcamento/unidades";

const CLASSE_SELECT = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

/**
 * Valor em reais, escrito como se lê: 20.000,00.
 *
 * Era `<input type="number">`, que mostra "20000" — num orçamento de casa, com
 * seis dígitos por linha, conferir isso a olho é onde o zero a mais passa.
 *
 * A digitação é por centavos: cada tecla empurra o número da direita para a
 * esquerda, como em terminal de cartão. Evita a briga de cursor que máscaras
 * que reformatam no meio do texto sempre produzem, e torna impossível digitar
 * um valor malformado.
 *
 * Envia o texto formatado mesmo. Quem recebe é `parseNumeroBR`, no servidor,
 * que já lê "20.000,00" e "20000.00" — não há hidden field para dessincronizar.
 */
export function CampoMoeda({
  id,
  name,
  defaultValue = 0,
  required,
}: {
  id: string;
  name: string;
  defaultValue?: number;
  required?: boolean;
}) {
  const [centavos, setCentavos] = useState(() => Math.round((defaultValue || 0) * 100));

  const formatado = (centavos / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  function handleChange(evento: React.ChangeEvent<HTMLInputElement>) {
    const digitos = evento.target.value.replace(/\D/g, "").slice(0, 13);
    setCentavos(digitos ? Number(digitos) : 0);
  }

  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground"
        aria-hidden
      >
        R$
      </span>
      <Input
        id={id}
        name={name}
        value={formatado}
        onChange={handleChange}
        onFocus={(e) => e.target.select()}
        inputMode="numeric"
        required={required}
        className="pl-8 text-right tabular-nums"
      />
    </div>
  );
}

/**
 * Unidade de medida, da lista fechada.
 *
 * O campo era livre e os dados saíram com 14 grafias para sete unidades
 * ("un"/"UN", "m²"/"M2"/"m2"...), o que quebra a busca de composição na SINAPI,
 * que casa unidade por igualdade exata.
 *
 * Duas saídas de emergência, as duas necessárias:
 *
 * - Unidade atual fora da lista entra como opção própria, com o texto
 *   original. Sem isso, abrir um item antigo em "m²" e salvar trocaria a
 *   unidade dele em silêncio pela primeira da lista.
 * - "Outra..." abre um campo livre. Lista fechada que não deixa cadastrar o
 *   que falta vira um impedimento, e unidade nova aparece.
 */
export function CampoUnidade({
  id,
  name,
  defaultValue = "",
  required,
}: {
  id: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  const conhecidas = UNIDADES.map((u) => u.valor) as readonly string[];
  const foraDaLista = !!defaultValue && !conhecidas.includes(defaultValue);

  const [valor, setValor] = useState(defaultValue);
  const [livre, setLivre] = useState(false);

  if (livre) {
    return (
      <div className="flex gap-1">
        <Input
          id={id}
          name={name}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="Ex.: M2XMES"
          required={required}
          autoFocus
        />
        <button
          type="button"
          onClick={() => {
            setLivre(false);
            setValor(defaultValue);
          }}
          className="shrink-0 text-xs text-primary-texto underline underline-offset-4"
        >
          Lista
        </button>
      </div>
    );
  }

  return (
    <select
      id={id}
      name={name}
      value={valor}
      required={required}
      onChange={(e) => {
        if (e.target.value === "__outra__") {
          setValor("");
          setLivre(true);
          return;
        }
        setValor(e.target.value);
      }}
      className={CLASSE_SELECT}
    >
      <option value="">Selecione...</option>
      {foraDaLista && <option value={defaultValue}>{defaultValue} (como está)</option>}
      {UNIDADES.map((u) => (
        <option key={u.valor} value={u.valor}>
          {u.label}
        </option>
      ))}
      <option value="__outra__">Outra...</option>
    </select>
  );
}
