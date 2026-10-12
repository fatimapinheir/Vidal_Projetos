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
  value,
  onValueChange,
  required,
}: {
  id: string;
  /** Omitido no modo controlado — ali o valor não viaja pelo formulário. */
  name?: string;
  defaultValue?: number;
  /**
   * Modo controlado, em reais.
   *
   * Existe para os formulários que montam o objeto em estado React e não
   * postam campos soltos — o picker de item da ordem de compra, por exemplo.
   * Sem isto, aquele campo teria a própria máscara de centavos e as duas
   * divergiriam na primeira correção feita só de um lado.
   */
  value?: number;
  onValueChange?: (reais: number) => void;
  required?: boolean;
}) {
  const controlado = onValueChange !== undefined;
  const [interno, setInterno] = useState(() => Math.round((defaultValue || 0) * 100));
  const centavos = controlado ? Math.round((value ?? 0) * 100) : interno;

  const formatado = (centavos / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  function handleChange(evento: React.ChangeEvent<HTMLInputElement>) {
    const digitos = evento.target.value.replace(/\D/g, "").slice(0, 13);
    const novos = digitos ? Number(digitos) : 0;
    if (controlado) onValueChange?.(novos / 100);
    else setInterno(novos);
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
  value,
  onValueChange,
  required,
}: {
  id: string;
  /** Omitido no modo controlado. */
  name?: string;
  defaultValue?: string;
  /** Modo controlado — ver a nota em `CampoMoeda`. */
  value?: string;
  onValueChange?: (unidade: string) => void;
  required?: boolean;
}) {
  const conhecidas = UNIDADES.map((u) => u.valor) as readonly string[];
  const foraDaLista = !!defaultValue && !conhecidas.includes(defaultValue);

  const controlado = onValueChange !== undefined;
  const [interno, setInterno] = useState(defaultValue);
  const valor = controlado ? (value ?? "") : interno;
  const definir = (v: string) => (controlado ? onValueChange?.(v) : setInterno(v));
  const [livre, setLivre] = useState(false);

  if (livre) {
    return (
      <div className="flex gap-1">
        <Input
          id={id}
          name={name}
          value={valor}
          onChange={(e) => definir(e.target.value)}
          placeholder="Ex.: M2XMES"
          required={required}
          autoFocus
        />
        <button
          type="button"
          onClick={() => {
            setLivre(false);
            definir(defaultValue);
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
          definir("");
          setLivre(true);
          return;
        }
        definir(e.target.value);
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
