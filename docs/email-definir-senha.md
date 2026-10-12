# E-mail de acesso do cliente

Quando o engenheiro cria o acesso de um cliente, o sistema chama
`resetPasswordForEmail`. Quem envia o e-mail é o **Supabase**, não a nossa
aplicação — então o template **não fica neste repositório**, e sim no painel.

O arquivo `email-definir-senha.html` ao lado é o conteúdo pronto para colar.

## Onde colar

Painel do Supabase → **Authentication** → **Emails** → aba **Templates** →
**Reset Password**.

- **Subject:** `Seu acesso ao acompanhamento da obra — Vidal Projetos`
- **Message body:** o conteúdo de `email-definir-senha.html`

Guardar o arquivo aqui serve para versionar o texto junto do projeto: alterar o
template no painel sem atualizar este arquivo faz os dois divergirem.

## O que não dá para mudar por aqui

`{{ .ConfirmationURL }}` é a variável do Supabase com o link de uso único. O
destino dela é configurado em **Authentication → URL Configuration → Redirect
URLs**, e precisa conter a URL de `/atualizar-senha` do ambiente — em produção,
`NEXT_PUBLIC_SITE_URL` deve estar definida, senão a aplicação cai no header
`Host` como último recurso.

## Limitação do remetente padrão

O SMTP nativo do Supabase é limitado a poucos e-mails por hora e envia de um
domínio que não é o seu, o que aumenta a chance de cair em spam. O código já
trata a falha de envio avisando o engenheiro, mas se o volume crescer, o
caminho é configurar SMTP próprio em **Project Settings → Authentication →
SMTP Settings** — aí o template continua sendo este, só muda quem envia.
