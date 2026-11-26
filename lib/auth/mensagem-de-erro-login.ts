/**
 * Traduz o que o Supabase devolve nos links de e-mail. A mensagem original vem
 * em inglês e não diz o que fazer — e o caso de longe mais comum (link expirado
 * ou já usado) tem uma causa que não é óbvia: leitores de e-mail e antivírus
 * abrem os links sozinhos para checar se são seguros, e como o link é de uso
 * único, ele já chega gasto.
 *
 * Mora em `lib/` e não dentro da página porque quem exibe a mensagem é um
 * componente de cliente: a página de login precisa ser estática (ver o
 * comentário em `app/(auth)/login/page.tsx`), então ela não pode ler o
 * `?erro=` no servidor.
 */
export function mensagemDeErroLogin(erro: string): string {
  const bruto = erro.toLowerCase();

  if (bruto.includes("expired") || bruto.includes("invalid") || erro === "link_invalido") {
    return "Esse link de e-mail não vale mais — ele é de uso único e expira. Vale saber que alguns leitores de e-mail e antivírus abrem os links sozinhos para checar segurança, e isso já consome o link antes de você clicar. Peça um novo e abra-o assim que chegar.";
  }
  if (erro === "link_incompleto") {
    return "O link veio incompleto e não deu para abrir a sessão. Peça um novo link.";
  }
  return erro;
}
