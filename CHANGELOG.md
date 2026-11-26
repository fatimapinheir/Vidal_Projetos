# Notas de versão — Ankora

O que mudou no sistema a cada publicação, em ordem do mais novo para o mais
antigo. Escrito para quem **usa** o sistema, não para quem lê o código: cada
item diz o que você vai notar na tela.

As migrações de banco estão listadas por versão porque elas valem para
`ankoragestao.com.br` no momento em que são aplicadas, que nem sempre é o
momento da publicação do site.

---

## 26/11/2026 — Diário no calendário e lápis visível

### O lápis de corrigir o nome do cliente estava invisível

Em Cadastros → Clientes dá para corrigir o nome de um cliente pelo lápis ao
lado dele. Só que o lápis **só aparecia quando o mouse passava por cima** — e
no celular isso simplesmente não existe, então ele ficava permanentemente
invisível. O botão estava lá e era clicável; só não havia como vê-lo.

Agora ele fica sempre visível, apagado, e ganha contraste quando o cursor
passa. A lista continua calma e a ação deixa de depender de adivinhação.

Isso aparece com frequência: cliente convidado só pelo e-mail nasce com o
e-mail no lugar do nome, e o portal cumprimenta com ele — "Olá,
fulano@email.com!".

### O diário do engenheiro abre no calendário

Era a listagem; passa a ser o **calendário**. A listagem continua a um clique,
na aba ao lado.

A razão é a mesma que levou o calendário a existir do lado do cliente: a lista
responde "o que foi registrado", e o calendário responde "o que aconteceu no
mês" — incluindo os dias em que **não** houve registro. Numa lista, o dia sem
folha simplesmente não aparece, e é justamente esse buraco que se procura.

Links antigos com `?visao=calendario` continuam funcionando.

---

## 26/11/2026 — Calendário do diário e correção do celular

### A visão geral parou de cortar à direita no celular

Na visão geral da obra, todos os cartões eram amputados do lado direito no
celular — "O engenheiro ainda não env…", "à frente dos valores pagos em…". Não
era um cartão: era a coluna inteira estourando e levando todos juntos.

A causa estava na trilha de etapas, que tem 144px por etapa e passa de 860px com
seis etapas. Ela tem rolagem própria e deveria rolar dentro de si, mas a coluna
do layout crescia com ela antes disso. E o corte era mudo: não aparecia nem
barra de rolagem avisando que havia conteúdo sobrando.

O portal do cliente, que mostra a mesma tela, nunca teve o problema — monta o
conteúdo de outro jeito.

### O diário de obra ganhou visão de calendário para o engenheiro

O cliente já via o diário em calendário; o engenheiro só tinha a listagem.
Agora a tela tem duas abas, **Listagem** e **Calendário**, como o cronograma já
faz com a timeline.

Duas diferenças em relação ao calendário do cliente, as duas propositais:

- **Mostra também os dias abertos.** O cliente só enxerga folha fechada; o
  engenheiro precisa ver a que está em andamento — senão a folha que ele acabou
  de salvar sumiria do próprio calendário dele.
- **Clicar num dia sem registro abre a folha para preencher**, em vez de abrir
  um aviso de que não houve registro. É justamente por isso que se procura um
  buraco no calendário.

A aba fica no endereço, então trocar de mês não joga você de volta para a
listagem, e o link pode ser compartilhado já no calendário.

---

## 26/11/2026 — Histórico de permissões e a tela no celular

### Agora fica registrado quem mudou o quê

Liberar uma permissão já ficava registrado, mas **retirar não deixava rastro
nenhum**. Isso ficou concreto hoje: cinco permissões foram revogadas pela tela,
e só deu para saber quais porque o estado anterior estava anotado fora do
sistema. A pergunta *"quem tirou essa permissão, e quando?"* o sistema não
sabia responder.

A tela de Permissões ganhou uma seção de **Histórico de alterações**: cada
liberação e cada retirada, com quem fez e quando. Promover e rebaixar
administrador entra no mesmo histórico — é a mudança mais grave do conjunto.

Duas observações honestas:

- **Mudanças anteriores a hoje não aparecem.** Elas eram apagadas, não
  guardadas, e isso não tem recuperação. Dar a elas uma data inventada seria
  fabricar registro de auditoria, que é pior do que não ter.
- Clicar numa chave que já estava na posição desejada **não gera registro** —
  só mudança de verdade entra, para o histórico não encher de linhas iguais.

### A tela de Permissões no celular

No telefone a matriz tinha 640px de largura e rolava para o lado. Ao rolar, a
primeira coluna — o **nome da permissão** — saía de vista, e você ficava
mexendo numa chave sem ver do que era. Como não havia nenhuma dica de que
rolava, a tela simplesmente parecia cortada à direita.

No celular agora você **escolhe a pessoa** e vê a lista de permissões dela,
uma por linha, com o nome sempre ao lado da chave. Nada rola para o lado. No
computador a matriz continua, porque lá a pergunta é comparativa: "quem pode
aprovar compra?".

---

## 26/11/2026 — RDO: correção de perda de texto e quatro seções novas

### O registro do dia estava sendo perdido ao fechar

Ardiles reportou que digitava o texto do dia e não salvava. A causa não era o
campo de texto — era a ordem dos botões.

O botão **"Fechar o dia"** fica num cartão acima do formulário, e ele **não
enviava o formulário**: gravava só o efetivo, os equipamentos, as tarefas e as
entregas congelados. Quem digitava o registro e clicava em "Fechar o dia" — que
é o que se faz ao terminar — perdia o texto, porque ele nunca chegava ao
servidor. E a folha ficava fechada, então salvar passava a responder "esse dia
está fechado".

A mensagem de confirmação ajudava a cair na armadilha: dizia que as coisas
"ficam congeladas como estão agora" e não avisava que o texto da tela não ia
junto.

**Isso aconteceu em 6 das 9 folhas já registradas.** O que foi perdido não tem
recuperação — nunca saiu do navegador.

**A correção:** o formulário ganhou um segundo botão, **"Salvar e fechar o
dia"**, que grava e fecha no mesmo clique. Por esse caminho é impossível
perder. O botão de cima continua existindo (ele também reabre o dia), e agora
avisa, com estas palavras, que o texto não salvo não será gravado.

### Quatro informações que eram salvas e nunca apareciam no relatório

Auditando o RDO coluna por coluna, apareceu que o documento imprimia só
atividades, ocorrências, clima, temperatura, efetivo e fotos. Ficavam de fora,
embora o sistema as guardasse a cada dia:

| Agora no RDO | O que estava acontecendo |
| ------------ | ------------------------ |
| **Tarefas do cronograma** | Congeladas no fechamento para durar — e não saíam no papel |
| **Equipamentos em obra** | Até 6 por dia registrados, nenhum impresso |
| **Entregas recebidas** | Até 4 por dia, mais o texto livre de entregas sem ordem de compra |
| **Visitas** | Campo **só de escrita**: o formulário coletava, o banco guardava, e nada no sistema mostrava de volta |

O caso das visitas era o pior: a tela de índice do diário *prometia* que elas
entravam no relatório, o engenheiro anotava a visita do fiscal, e aquilo
desaparecia de vista para sempre. Registrar a visita do fiscal e não ter onde
provar é o contrário do que um RDO serve.

Os equipamentos e as entregas anotados à mão (sem locação ou ordem de compra
cadastrada) entram na **mesma lista** dos cadastrados. No papel essa distinção
não interessa: quem lê quer saber o que estava em obra, não de onde veio o
registro.

O registro fotográfico passou a ser a seção 10.

---

## 26/11/2026 — Pagamento sem comprovante, por permissão

### O comprovante deixa de ser obrigatório para quem você autorizar

Até agora o comprovante era exigido sempre, em três lugares: ao registrar um
lançamento, ao marcar uma parcela como paga e ao aprovar-e-pagar uma ordem de
compra. A razão é boa e continua valendo — o lançamento descreve **dinheiro que
já saiu**, e sem comprovante é uma afirmação sem lastro dentro do custo da obra.

Por isso a obrigatoriedade **continua sendo o padrão**. O que mudou é que agora
existe uma exceção nomeada: a permissão **"Registrar pagamento sem
comprovante"**, na tela de Permissões, dentro do grupo Compras.

**Só o Thiago tem.** Diferente das outras treze permissões, esta não foi dada
ao Ardiles — aquelas preservavam o que ele já podia, e esta é capacidade nova,
que não existia para ninguém. Você pode conceder a mais alguém na tela quando
quiser.

### O que ela não faz

**Não vale para o portal do cliente.** Quem registra pagamento pelo portal
continua obrigado a anexar, independente de qualquer chave — é a única escrita
financeira aberta ao cliente, e é justamente a que mais precisa de lastro.

Isso foi testado com a mesma pessoa: Ardiles, com a permissão concedida, é
recusado quando está no perfil de cliente e aceito no perfil de engenheiro.

### Na prática

Quem tem a permissão vê o campo de comprovante deixar de ser obrigatório, e o
texto do diálogo muda de *"Sem ele o pagamento não é registrado"* para *"Você
pode registrar sem ele"*. Quem não tem continua vendo o campo exigido, igual a
antes.

A regra foi para **dentro do banco**, não só na tela: mesmo quem chamasse o
sistema por fora continuaria barrado. E uma arrumação de bastidor que importa —
um comprovante "vazio" deixou de ser possível de gravar, porque uma string
vazia passaria por "tem comprovante" no cálculo de mensalidade de locação.

---

## 26/11/2026 — Permissões por usuário

### Agora dá para dizer o que cada engenheiro pode

Até hoje "engenheiro" era o teto do sistema: quem tinha esse perfil podia
exatamente tudo que outro engenheiro podia — inclusive **excluir uma obra
inteira**, aprovar ordem de compra e criar acesso para clientes. Com um
engenheiro novo entrando, ele nasceria com esses mesmos poderes.

Existe agora uma tela de **Permissões** (em Cadastros, visível só para quem
administra) com uma chave por permissão e por pessoa. São 13 permissões,
agrupadas por assunto:

| Assunto | O que se controla |
| ------- | ----------------- |
| Obras | criar, excluir |
| Orçamento | tornar uma versão oficial |
| Cotações | escolher ou recusar proposta, excluir |
| Compras | aprovar ou recusar, registrar pagamento, excluir |
| RH | marcar fechamento como pago |
| Diário | reabrir dia fechado, excluir RDO |
| Acessos | convidar e vincular clientes |
| Cadastros | publicar nova tabela SINAPI |

**O trabalho do dia a dia não passa por aqui.** Lançar tarefa no cronograma,
salvar RDO, montar orçamento, registrar presença, tirar foto — todo engenheiro
continua fazendo, sem chave nenhuma. A lista cobre só o que é irreversível,
move dinheiro, ou decide quem entra no sistema. Fossem as 121 ações do sistema,
a tela seria ilegível e atrapalharia quem só quer trabalhar.

### Quem administra

Thiago e Fátima administram permissões. Isso é separado do perfil de
engenheiro, de propósito: administrar não é uma cadeira onde se senta, é uma
chave que se carrega — ninguém quer "entrar no modo administrador" para aprovar
uma compra e sair depois. Administrador pode tudo e não aparece na lista de
chaves, porque as dele estariam todas ligadas e travadas.

Duas travas: ninguém retira a própria administração (tem que pedir a outro
administrador), e o sistema nunca fica sem nenhum.

### Como cada um ficou

- **Ardiles** entrou com **todas as 13 permissões marcadas** — exatamente o que
  ele já podia. Nada mudou para ele, e retirar passa a ser decisão consciente
  na tela, não efeito colateral desta atualização.
- **O engenheiro que entra hoje** começa **sem nenhuma** permissão de decisão.
  Ele trabalha normalmente desde o primeiro minuto; o que depende de liberação
  é aprovar, excluir e pagar.
- **Revogar vale na hora.** A verificação lê o banco a cada clique, não o
  token — então uma chave desligada tem efeito no clique seguinte, sem esperar
  a pessoa sair e entrar de novo.

### Uma observação honesta

Quem tem perfil duplo (Ardiles e Fátima) pode aprovar uma compra **pelo lado do
cliente** numa obra em que é cliente, mesmo sem a permissão de engenheiro.
Está coerente — ali ele age como cliente da obra, e a permissão restringe a
capacidade de engenheiro, não os direitos de cliente — mas vale saber que o
caminho existe.

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
