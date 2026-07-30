<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Sistema de Gestão de Obras — Vidal Projetos

Sistema web para um engenheiro civil que gerencia obras de múltiplos clientes
(residenciais e comerciais). Substituiu um projeto antigo e sem relação (landing
page de templates Revit), que foi apagado.

**Plano com todo o histórico de decisões de produto:** `~/.claude/plans/iterative-cuddling-boot.md` — leia antes de trabalhar em qualquer feature grande.

## Stack e armadilhas conhecidas

- **Next.js 16** (App Router, Turbopack, TypeScript estrito). Nessa versão o
  `middleware.ts` chama-se `proxy.ts`, e a função exportada é `proxy`.
- **Supabase** (Postgres + Auth + Storage). RLS por toda parte, via as funções
  `security definer` `is_engenheiro()` e `cliente_tem_acesso_obra(obra_id)`.
  Ações do cliente (aprovar/recusar/pagar) passam por RPCs, nunca por UPDATE
  direto — o cliente não pode alterar valores nem datas.
- **shadcn/ui no estilo "base-nova"**, que roda sobre **@base-ui/react (não
  Radix)**. Consequências práticas: composição polimórfica usa a prop `render`
  (não `asChild`), e `Button` precisa de `nativeButton={false}` quando renderiza
  um elemento não-nativo como `<Link>`.
- **xlsx (SheetJS)** vem do CDN da própria SheetJS, não do registro npm (a versão
  do npm tem vulnerabilidades conhecidas).
- `lib/types/database.types.ts` é **escrito à mão** — não há Docker neste
  ambiente para rodar `supabase gen types`. Mantenha em sincronia manualmente a
  cada mudança de schema.
- Chaves do Supabase Storage rejeitam caracteres não-ASCII. Sempre passe nomes de
  arquivo por `sanitizeFilename()` (`lib/sanitize-filename.ts`) antes de montar
  o caminho.
- **Arquivo nunca passa por Server Action.** Em produção (Netlify) a função
  aceita ~4,5 MB de binário depois do base64, e em `localhost` esse teto não
  existe — ou seja, o erro só aparece com dado real, em campo. Use
  `lib/storage/upload-direto.ts`: o navegador envia direto ao Storage e a ação
  recebe só o caminho. Duas consequências: toda saída por erro na ação precisa
  **remover o arquivo** já enviado (senão fica órfão no bucket), e o caminho vem
  do cliente, então precisa ser validado contra o prefixo esperado.
  (O `bodySizeLimit: 20mb` em `next.config.ts` cobre só o JSON dos itens
  parseados de planilha.)
- **Gráfico usa paleta própria** (`--grafico-*`), não `--sucesso`/`--atencao`:
  aquelas foram calibradas para texto e são claras demais para marca preenchida
  em fundo escuro. As de gráfico são validadas (faixa de luminosidade, croma,
  separação sob daltonismo, contraste) — mexeu, rode o validador da skill
  `dataviz` de novo. `--grafico-trilho` é cinza de propósito: é trilho, não série.
- **`vw_equipe_ativa_obra` é a única view `security_invoker = false` do projeto.**
  Ela existe para dar ao cliente a contagem de equipe sem abrir a folha de
  pagamento, e a guarda `(is_engenheiro() or cliente_tem_acesso_obra(...))`
  dentro dela é o que impede o vazamento. Não remova esse predicado.
- **Links de e-mail do Supabase devolvem o resultado no fragmento da URL**
  (`#access_token=...` / `#error=...`), que o servidor nunca recebe. Quem lê
  isso é `components/auth/auth-hash-handler.tsx`, montado no layout raiz — o
  link pode aterrissar em qualquer rota. A rota `/auth/confirm` é o caminho
  preferido (troca por cookie no servidor); depende do modelo de e-mail no
  painel apontar para ela com `{{ .TokenHash }}`.
- **O sistema é usado em campo, no celular** (iPhone 13 Pro em diante) e em
  tablet. Toda tela nova precisa passar em 390px de largura. Duas armadilhas já
  pagas: `xs:` **não existe** no Tailwind v4 (o menor breakpoint é `sm:`, e
  escrever `xs:` não dá erro, só não faz nada); e altura de overlay usa `svh`,
  não `vh` — no Safari do iPhone a barra de endereço entra na conta de `vh`.
- **Tema escuro fixo** (classe `dark` no `<html>`): preto dominante, branco no
  texto, vermelho só como destaque. Existem **dois vermelhos** e eles não são
  intercambiáveis: `--primary` para preenchimento (escuro, aceita texto branco
  por cima) e `--primary-texto` para texto e traço fino (claro, legível no
  preto). Verde e âmbar só via `--sucesso`/`--atencao`, e só para codificar
  dado — nunca cor fixa do Tailwind.

## Rodando comandos

`npm` está no nvm em user space — rode `source ~/.nvm/nvm.sh` antes de qualquer
comando npm/node.

Migrations são aplicadas conectando direto no Postgres com o pacote `pg`
instalado temporariamente (`npm install --no-save pg`, e desinstale ao final).
Não existe Supabase CLI logado neste ambiente.

## Funcionalidades

Dois papéis: **engenheiro** (acesso total) e **cliente** (portal restrito às
obras dele; nunca vê dados de folha de pagamento).

1. **Obras** — CRUD, vínculo de clientes (uma obra pode ter vários), status.
2. **Equipe** — trabalhadores reutilizáveis entre obras com diária específica por
   obra; **equipes** agrupam trabalhadores com um responsável e um tipo de
   contrato (diária ou empreitada).
3. **Presenças** — lançamento diário por obra.
4. **Diário de obra (RDO)** — uma folha por obra/dia. Efetivo, equipamentos,
   tarefas previstas e entregas de material **não são digitados**: vêm de
   Presenças, Locações, Cronograma e parcelas de compra. **Fechar o dia**
   congela isso em `*_snapshot` e publica a folha para o cliente; reabrir limpa
   os snapshots e marca `reaberto_em`. O banco garante a invariante (aberto = 0
   snapshots, fechado = 4) — não confie só na action.
5. **Fechamentos** — três modos: individual (um trabalhador por vez), **por
   equipe** (todos de uma vez, um comprovante só, pago ao responsável) e **por
   entrega/empreitada** (quantidade entregue × valor por unidade).
6. **Tabela SINAPI** — catálogo global de preços de referência (não pertence a
   nenhuma obra), atualizado por upload mensal de planilha. O wizard de upload
   deixa o engenheiro escolher a linha de cabeçalho e mapear as colunas; o
   mapeamento é salvo e reaproveitado.
7. **Planejamento** (o nome de interface para "orçamento") — estimativa por obra,
   montada item a item (buscando na SINAPI ou cadastrando avulso) ou importando
   planilha. Ciclo de vida rascunho → ativa → substituída, com histórico de
   revisões consultável.
8. **Ordens de Compra** (o nome de interface para "compras") — itens vindos do
   planejamento ou avulsos, **dois níveis independentes de desconto** (por item e
   da nota, cada um podendo ser R$ ou %, escolhido caso a caso), parcelas com
   valor auto-dividido igualmente (editável para exceções), e aprovação do
   cliente **opcional** (checkbox; sem marcar, a ordem já nasce aprovada para não
   travar o fluxo).
9. **Locação de equipamentos** — aluguel por obra, cobrado por dia ou por hora.
   O valor **não é fechado**: corre enquanto o equipamento está na obra e só
   congela quando marcado como devolvido. Por isso não há coluna de total no
   banco (é derivado em `lib/locacoes/calculo.ts`) nem flag `devolvido`
   (é `data_devolucao` preenchida). Por hora, as horas são informadas pelo
   engenheiro — o sistema não deduz do tempo decorrido.
10. **Cronograma (EAP)** — Etapa → Tarefa (2 níveis), **CPM completo** com os 4
   tipos de dependência + lag, caminho crítico, coluna **"Margem"** (a folga do
   CPM — nome escolhido justamente para não conflitar com a aba Folgas),
   **"Fixar linha de base"** acionado manualmente pelo engenheiro quando o plano
   está pronto, propagação automática de atraso real para as sucessoras,
   encadeamento automático de datas (tarefa nova assume que começa após a
   anterior, com opção de desmarcar para tarefas em paralelo) e **lembretes** por
   tarefa (avisa X dias antes do início).
11. **Folgas** — aba própria com calendário clicável (marca/desmarca um dia) mais
   registro de intervalos maiores. Entram no cálculo do cronograma como dias
   não-úteis, independente de fim de semana ou feriado.
12. **Dashboards** — engenheiro (agregado de todas as obras) e cliente (parcelas
    vencidas sempre no topo, depois as próximas). Ambos mostram card de lembretes
    ativos.

## Disciplina de trabalho

- Rode `npm run build` depois de mudanças — o TypeScript é estrito e o build é o
  que pega erro de tipo.
- Verifique de verdade no navegador antes de dizer que está pronto. Não peça para
  a usuária testar no seu lugar.
- Dados de teste levam prefixo `TESTE-...-TMP` e são **sempre removidos** no
  final (obra, trabalhadores, objetos no storage).
- Scripts temporários seguem o padrão `scripts-tmp-*.cjs` na raiz e são apagados
  ao terminar. Desinstale o `pg` depois de aplicar migration.
