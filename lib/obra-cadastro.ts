/**
 * Listas de apoio do cadastro da obra.
 *
 * Moram no código, não no banco, de propósito: são listas curtas que ainda vão
 * mudar enquanto o fluxo se assenta, e cada ajuste no banco custaria uma
 * migração. O "Tipo de obra" é a exceção — aquele é cadastro de verdade, criado
 * pelo engenheiro pela tela, e por isso virou tabela.
 */

export const CATEGORIAS_OBRA = ["Obra de construção"] as const;

/** Nomenclatura da SINAPI/CUB, a mesma base da tabela já importada no sistema. */
export const PADROES_ACABAMENTO = ["Popular", "Normal", "Alto"] as const;

/**
 * Segmento de mercado da obra residencial.
 *
 * Não é a mesma coisa que o padrão de acabamento acima, embora as duas listas
 * tenham três níveis: o padrão descreve o acabamento executado, a faixa
 * descreve para quem a obra é — e é ela que vai escolher o template de
 * orçamento quando os templates existirem. Hoje o valor é só guardado.
 *
 * "Não definida" não entra aqui: é a opção vazia do select, que grava nulo.
 */
export const FAIXAS_TEMPLATE = [
  "MCMV / Habitação Popular",
  "Classe Média",
  "Alto Padrão",
] as const;

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

type PartesEndereco = {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
};

/**
 * Monta o endereço numa linha, para listas e cabeçalhos.
 *
 * Existe porque o endereço deixou de ser um campo só: sem isso, cada tela
 * concatenaria os pedaços do seu jeito e logo estariam divergindo. Pula o que
 * estiver vazio — obra recém-cadastrada costuma ter metade dos campos em
 * branco, e separador solto ("— , /") denuncia campo faltando sem informar
 * nada.
 */
export function formatarEndereco(partes: PartesEndereco): string | null {
  const limpa = (v?: string | null) => v?.trim() || null;

  const rua = [limpa(partes.logradouro), limpa(partes.numero)].filter(Boolean).join(", ");
  const comComplemento = [rua || null, limpa(partes.complemento)].filter(Boolean).join(" — ");

  const cidadeUf = [limpa(partes.cidade), limpa(partes.uf)].filter(Boolean).join("/");
  const regiao = [limpa(partes.bairro), cidadeUf || null].filter(Boolean).join(", ");

  const completo = [comComplemento || null, regiao || null].filter(Boolean).join(" — ");
  return completo || null;
}

/** Só dígitos, no formato 00000-000. Devolve o que veio se não tiver 8 dígitos. */
export function formatarCep(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 8);
  if (digitos.length !== 8) return digitos;
  return `${digitos.slice(0, 5)}-${digitos.slice(5)}`;
}
