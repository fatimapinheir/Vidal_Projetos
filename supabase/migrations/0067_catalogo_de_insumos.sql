-- Um cadastro de insumos, para parar de redigitar o que já foi digitado.
--
-- Hoje cada item de compra nasce de um formulário que pede descrição, unidade,
-- quantidade e preço — tudo, toda vez. Comprar barrote hoje e barrote amanhã
-- são dois cadastros do zero. Os dados contam o resultado:
--
--   * dos 33 itens lançados, ZERO vieram do seletor de item planejado. Todos
--     foram digitados em "Item avulso" — a busca que existe não serve;
--   * 64 dos 70 lançamentos não têm item nenhum. O insumo foi escrito na
--     descrição, em prosa, com quantidade e preço dentro do texto:
--       "3 telhas de 4 metros a 30 o metro / 30 parafusos a 4 reais"
--       "barrote, chapa, tabua de pinus, chapa madeirite."
--     Isso não soma, não filtra e não vira relatório;
--   * a repetição já começou — areia 2×, cimento 2×, alvará de construção 2×,
--     pagamento mão de obra 3× — e as unidades já divergem: UN, M, VB, mês.
--
-- O catálogo separa duas perguntas que o formulário hoje mistura: O QUE É o
-- insumo (descrição, categoria de custo, unidade) se cadastra uma vez; QUANTO
-- e POR QUANTO é de cada compra. Escolhido o insumo, a unidade vem com ele e
-- só restam quantidade e valor.
--
-- SEM PREÇO, de propósito. O preço é do dia da compra e do fornecedor daquele
-- dia; guardá-lo no cadastro criaria um número desatualizado com cara de
-- verdade.
--
-- A categoria é a CATEGORIA DE CUSTO — material, serviço ou mão de obra — a
-- mesma do orçamento e da ordem de compra. Não é a categoria do fornecedor
-- (Elétrica, Hidráulica...), que continua sendo coisa do fornecedor.

-- ---------------------------------------------------------------------------
-- 1. O catálogo
create table if not exists insumos (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  -- Mesmo domínio de `compras.tipo_item` e `orcamento_itens.tipo_item`: texto
  -- com check, não enum, para seguir o que a base já usa. Aqui é NOT NULL —
  -- insumo sem categoria de custo não classifica gasto nenhum, e é justamente
  -- a classificação que se quer ganhar.
  categoria_custo text not null
    check (categoria_custo in ('material', 'servico', 'mao_de_obra')),
  -- Lista fechada de `lib/orcamento/unidades.ts`. O banco não repete a lista:
  -- ela muda com a tela, e um check aqui viraria migração a cada unidade nova.
  unidade text not null,
  /*
   * `ativo` e a lixeira resolvem coisas diferentes.
   *
   * O insumo que a obra deixou de comprar não deve poluir a busca, mas apagá-lo
   * seria perder o cadastro. `ativo = false` tira da busca e mantém na
   * listagem. A lixeira apaga de verdade, e isso é seguro porque o item da
   * compra guarda a própria cópia de descrição e unidade — ver o item 2.
   */
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Sobre `lower(btrim(...))`, como em `funcoes`: é esse índice que impede
-- "Barrote" e "barrote " de voltarem a existir lado a lado — que é o problema
-- que o catálogo existe para resolver.
create unique index if not exists idx_insumos_descricao_unica
  on insumos (lower(btrim(descricao)));

-- Busca por pedaço do nome: quem digita "barro" tem de achar "Barrote de
-- Pinus 5x5". `ilike '%termo%'` não usa índice btree; trigrama usa.
create index if not exists idx_insumos_descricao_trgm
  on insumos using gin (descricao gin_trgm_ops);

alter table insumos enable row level security;

-- `(select is_engenheiro())` e não `is_engenheiro()`: a forma com select vira
-- InitPlan avaliado UMA vez por consulta, em vez de uma vez por linha lida.
-- É a correção de desempenho da 0059, e toda policy nova nasce assim.
create policy eng_all_insumos on insumos
  for all using ((select is_engenheiro())) with check ((select is_engenheiro()));

-- O cliente LÊ, e só. Ele registra despesa da obra dele pelo portal e precisa
-- escolher o insumo; criar insumo novo não — senão o catálogo enche de
-- grafias diferentes da mesma coisa, que é o problema de origem.
create policy cli_select_insumos on insumos for select
  using (auth.uid() is not null);

comment on table insumos is
  'Catálogo de insumos: o que se compra, cadastrado uma vez. Sem preço — preço é do dia da compra. Alimenta o seletor de itens da ordem de compra e do lançamento.';

-- ---------------------------------------------------------------------------
-- 2. O item da compra aponta para o catálogo — e guarda a própria cópia
--
-- `on delete set null`, e `descricao`/`unidade` continuam gravadas no item.
--
-- Isso é deliberado, e é a mesma regra do RDO fechado: renomear um insumo
-- amanhã não pode reescrever a nota fiscal de ontem. O vínculo serve para
-- agrupar e relatar; o texto do item é o que foi comprado naquele dia, e
-- apagar o insumo do catálogo não apaga a história.
alter table compra_itens
  add column if not exists insumo_id uuid references insumos(id) on delete set null;

create index if not exists idx_compra_itens_insumo
  on compra_itens (insumo_id) where insumo_id is not null;

comment on column compra_itens.insumo_id is
  'Insumo do catálogo, quando o item veio de lá. `descricao` e `unidade` seguem gravadas no item: são a cópia do que foi comprado, e não mudam se o insumo for renomeado ou apagado.';
