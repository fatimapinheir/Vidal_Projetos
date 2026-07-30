/**
 * Remove acentos e caracteres especiais de um nome de arquivo antes de usa-lo
 * como parte de uma chave no Supabase Storage. Chaves com caracteres nao-ASCII
 * (ex: "Referencia" com o til) sao rejeitadas pela API com "Invalid key".
 */
export function sanitizeFilename(filename: string): string {
  const codigoInicial = 0x0300;
  const codigoFinal = 0x036f;
  const semAcentos = Array.from(filename.normalize("NFD"))
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code < codigoInicial || code > codigoFinal;
    })
    .join("");
  return semAcentos.replace(/[^a-zA-Z0-9._-]/g, "_");
}
