/**
 * CPF e CNPJ: validação por dígito verificador e formatação.
 *
 * Valida o dígito, não só a quantidade de números. A diferença aparece no uso
 * real: quase todo erro de CPF é dígito trocado ou invertido na digitação, e
 * contar 11 caracteres aceita todos eles. Como esse documento vai para
 * requerimento de prefeitura, errado ali custa retrabalho de verdade.
 */

export type TipoPessoa = "pf" | "pj";

export const soDigitos = (valor: string) => valor.replace(/\D/g, "");

/**
 * O cálculo é o mesmo nos dois documentos: soma ponderada dos dígitos, resto
 * da divisão por 11, e o verificador é 0 quando o resto é menor que 2.
 */
function digitoVerificador(base: string, pesos: number[]): number {
  const soma = pesos.reduce((acc, peso, i) => acc + Number(base[i]) * peso, 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function validarCpf(valor: string): boolean {
  const d = soDigitos(valor);
  if (d.length !== 11) return false;
  // 111.111.111-11 e afins passam na conta do dígito, mas não são CPF.
  if (/^(\d)\1{10}$/.test(d)) return false;

  const d1 = digitoVerificador(d, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digitoVerificador(d, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(d[9]) && d2 === Number(d[10]);
}

export function validarCnpj(valor: string): boolean {
  const d = soDigitos(valor);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;

  const d1 = digitoVerificador(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digitoVerificador(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(d[12]) && d2 === Number(d[13]);
}

export function validarDocumento(tipo: TipoPessoa, valor: string): boolean {
  return tipo === "pf" ? validarCpf(valor) : validarCnpj(valor);
}

/** Aplica a máscara conforme o tipo; devolve o que veio enquanto está incompleto. */
export function formatarDocumento(tipo: TipoPessoa, valor: string): string {
  const d = soDigitos(valor);

  if (tipo === "pf") {
    const n = d.slice(0, 11);
    return n
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
  }

  const n = d.slice(0, 14);
  return n
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
}

export const rotuloDocumento = (tipo: TipoPessoa) => (tipo === "pf" ? "CPF" : "CNPJ");
