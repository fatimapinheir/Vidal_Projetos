# Notas de versão — Ankora

O que mudou no sistema a cada publicação, em ordem do mais novo para o mais
antigo. Escrito para quem **usa** o sistema, não para quem lê o código: cada
item diz o que você vai notar na tela.

As migrações de banco estão listadas por versão porque elas valem para
`ankoragestao.com.br` no momento em que são aplicadas, que nem sempre é o
momento da publicação do site.

---

## 12/11/2026

### Um usuário pode ter dois perfis

Quem é cliente de uma obra **e** engenheiro agora tem os dois perfis na mesma
conta, e troca entre eles pelo ícone do nome, no canto superior direito. Antes
era um perfil por pessoa, e isso trancava o Ardiles fora do portal — que é
justamente onde a obra dele aparece.

A troca é de verdade, não é "modo de visualização": no perfil de cliente ele
vê e faz o que um cliente vê e faz, nada além.

### Alterar a senha pelo próprio sistema

No mesmo menu do ícone do nome. Pede a senha atual antes de trocar — sem isso,
quem alcançasse um celular ou computador já logado trocaria a senha e tomaria a
conta. Não precisa mais passar pela recuperação por e-mail.

### Obra padrão

Quem tem os dois perfis escolhe em qual obra o perfil de engenheiro abre, e
passa a entrar direto na visão geral dela em vez do painel de todas as obras.
Na primeira vez o sistema pergunta sozinho; depois fica no menu do nome.

### Menu mais curto

- **Folgas**, **Presenças** e **Fechamentos** entraram num cartão único
  chamado **RH**, que abre e fecha.
- **Dashboard** saiu do menu. A tela continua existindo — é onde você cai ao
  entrar sem obra padrão definida.
- O rótulo "GERENCIAR" saiu. RH e Cadastros fecham a coluna juntos.

### O RDO passa a saber quem é o responsável técnico

**Campo novo no cadastro da obra: Responsável técnico.** É dele o nome, o CREA,
a assinatura e a logo que saem no RDO — não importa quem registrou ou fechou o
dia.

Antes, quem assinava era quem fechasse o dia. Dos quatro RDOs já existentes,
**três estavam errados**:

| Data  | Quem assinava                                       | Quem assina agora |
| ----- | --------------------------------------------------- | ----------------- |
| 10/11 | Ardiles — sem CREA, sem assinatura e **sem a logo** | Thiago, com CREA  |
| 16/10 | quem estivesse olhando a tela                       | Thiago            |
| 15/10 | Thiago, só porque foi ele quem fechou               | Thiago            |
| 13/10 | Thiago                                              | Thiago            |

A logo da construtora também vinha do perfil de quem fechava, então sumia do
cabeçalho quando quem fechava não tinha logo cadastrada. Agora sai sempre.

### O RDO diz quem registrou o dia

Linha nova abaixo da assinatura: **REGISTRADO POR**. Só aparece quando é outra
pessoa — o auxiliar registra, o responsável técnico assina, e o documento passa
a dizer os dois sem sugerir que o segundo nome também assina.

### Nome do PDF do RDO

Ao salvar o RDO em PDF, o arquivo já vem nomeado:

```
RDO 10.11.26 - CASA VIDAL ALPHA.pdf
```

O separador da data é ponto e não barra porque `/` é separador de pasta e não
pode existir em nome de arquivo — pedido como `DD/MM/AA`, cada navegador
trocaria a barra por um caractere diferente.

### Banco de dados

`0079` perfis múltiplos e obra padrão · `0080` correção na checagem de papel ·
`0081` responsável técnico da obra

---

## 08/11/2026

### Cotações

Menu novo, antes de Ordens de Compra nos dois lados — é a ordem em que as
coisas acontecem: pede-se preço, compara-se, e só então existe uma ordem.

Uma cotação é **uma necessidade de compra com várias propostas penduradas**.
Cada proposta é um fornecedor com o que ele cotou, por quanto, em que prazo e
em quantas parcelas, com anexo opcional do documento que ele mandou.

Como funciona:

1. Você cria a cotação dizendo o que está sendo comprado.
2. Cadastra as propostas, uma por fornecedor.
3. Envia ao cliente — enquanto não envia, ele não vê nada.
4. O cliente compara e escolhe uma, ou recusa todas dizendo o motivo. Você
   também pode escolher, a qualquer momento.
5. **Só a escolhida vira ordem de compra**, já aprovada, com os itens e as
   parcelas da proposta. As outras ficam registradas como não escolhidas.

Na comparação, a mais barata recebe o selo **Menor valor** e as outras mostram
quanto estão acima dela. É rótulo, não recomendação: prazo e fornecedor pesam
tanto quanto preço.

**Nenhum valor cotado entra em painel, orçamento ou custo da obra.** O que
aparece na visão geral é só o aviso de que existe cotação esperando decisão. O
valor só passa a contar quando a proposta escolhida vira ordem de compra.

### Edição de item

Item já lançado numa ordem de compra ou num lançamento financeiro agora pode
ser corrigido. Antes era preciso excluir e lançar de novo.

### Banco de dados

`0077` cotações com propostas · `0078` ordenação da lista de cotações
