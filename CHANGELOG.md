# Notas de versão — Ankora

O que mudou no sistema a cada publicação, em ordem do mais novo para o mais
antigo. Escrito para quem **usa** o sistema, não para quem lê o código: cada
item diz o que você vai notar na tela.

As migrações de banco estão listadas por versão porque elas valem para
`ankoragestao.com.br` no momento em que são aplicadas, que nem sempre é o
momento da publicação do site.

---

## 26/11/2026

### A tela de login abre na hora, não em cinco segundos

Faltava fechar a última ponta da lentidão: quando ninguém usava o sistema por
um tempo, o servidor "adormecia", e a primeira pessoa a entrar pagava a espera
de acordá-lo. Medido em produção, a tela de login levava **5,2 segundos** para
aparecer nesse caso — contra 0,2 segundo com o servidor já acordado.

O pior é que isso acontecia justamente na porta de entrada, que é a primeira
coisa que qualquer pessoa vê.

Duas mudanças resolveram:

**A tela de login virou uma página pronta.** Ela não precisava do servidor para
nada — era montada na hora só para decidir se mostrava um aviso de link de
e-mail expirado, que quase nunca aparece. Agora ela vem pronta, direto do
servidor de conteúdo. Medido em produção, ela responde em **~175 ms**, e com
uma regularidade que a versão anterior não tinha: entre a amostra mais rápida e
a mais lenta há 12 ms de diferença, contra 41 ms da página montada na hora. O
aviso de link expirado continua funcionando igual.

**O servidor acorda enquanto você digita.** Como a tela de login não acorda
mais o servidor, a espera iria aparecer no clique em "Entrar". Então a tela
agora pede o despertar do servidor no momento em que abre: preencher e-mail e
senha leva uns 10 a 15 segundos, tempo suficiente para ele subir em paralelo.
Quando você clica em "Entrar", já está pronto.

| Abrir a tela de login | Antes   | Depois      |
| --------------------- | ------- | ----------- |
| Servidor adormecido   | 5,2 s   | **~175 ms** |
| Servidor acordado     | ~215 ms | **~175 ms** |

Uma observação honesta: o sistema roda em vários servidores ao mesmo tempo, e
não há como garantir que o que foi acordado seja exatamente o que vai receber o
seu login. Num sistema com o nosso volume de uso isso acerta na grande maioria
das vezes, mas não é uma garantia absoluta.

Quem já está logado e volta ao sistema depois de horas ainda pode encontrar
essa espera na primeira tela. Resolver esse caso exige manter o servidor
acordado de forma contínua, o que tem custo e ficou para uma próxima avaliação.

---

## 16/11/2026

### O sistema ficou cerca de 1,6 segundo mais rápido por tela

O cliente reclamou da lentidão de novo, e a causa era de infraestrutura: as
funções que montam as páginas rodavam na **Virgínia** enquanto o banco de dados
está em **São Paulo**. Cada tela conversa com o banco algumas vezes, e cada
conversa atravessava o continente.

Medido de dentro do servidor, antes e depois de mover as funções para São
Paulo:

| Ida e volta ao banco | Antes (Virgínia) | Depois (São Paulo) |
| -------------------- | ---------------- | ------------------ |
| Mediana              | 417 ms           | **50 ms**          |
| Pior caso            | 951 ms           | **90 ms**          |

São **8 vezes** mais rápido — e, o que importa tanto quanto, muito mais
constante: a diferença entre a consulta mais rápida e a mais lenta caiu de
792 ms para 56 ms. A lentidão não era só grande, era imprevisível.

Junto, três consultas que estavam sendo feitas **em fila** passaram a ser
feitas ao mesmo tempo, e a tela inicial do cliente deixou de esperar uma
consulta para só então começar as outras.

Somando tudo, a tela inicial do cliente:

|       | Espera no banco | Total       |
| ----- | --------------- | ----------- |
| Antes | 1.668 ms        | ~1.783 ms   |
| Agora | **100 ms**      | **~151 ms** |

O carregamento das telas em si também melhorou 32%, porque o servidor ficou
mais perto de quem usa.

**O que ainda não está resolvido:** depois de um tempo sem ninguém acessar, a
primeira pessoa a abrir o sistema pode esperar alguns segundos enquanto o
servidor "acorda". É ocasional, diferente da lentidão anterior que acontecia
em toda tela, e será tratado à parte.

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
passa a entrar direto na visão geral dela. Na primeira vez o sistema pergunta
sozinho; depois a opção fica no menu do nome.

### Menu mais curto

- **Folgas**, **Presenças** e **Fechamentos** entraram num cartão único
  chamado **RH**, que abre e fecha.
- **Dashboard** saiu do menu, e a entrada do engenheiro passou a ser uma obra.
  Ao entrar, o sistema abre a **obra padrão**; se não houver, a **última obra
  que você abriu**; e só se não souber nenhuma das duas é que mostra a tela de
  escolher obra. A tela do Dashboard continua existindo, mas nada mais leva
  até ela.
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
