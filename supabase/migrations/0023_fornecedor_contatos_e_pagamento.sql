-- Fornecedor: vendedores e condições de pagamento.

-- 1) Vendedores.
--
-- O telefone que já existia em `fornecedores` é o da empresa. Na prática quem
-- atende é um vendedor específico, e o mesmo fornecedor costuma ter vários,
-- cada um com o próprio número e a própria cartela de clientes. Isso é
-- um-para-muitos — não cabe em coluna.

create table fornecedor_contatos (
  id uuid primary key default gen_random_uuid(),
  fornecedor_id uuid not null references fornecedores(id) on delete cascade,
  nome text not null,
  telefone text,
  email text,
  -- O vendedor que atende esta conta. Não é restrição única de propósito:
  -- durante uma troca de vendedor é comum ter dois marcados por um tempo, e
  -- travar isso no banco atrapalharia mais do que ajudaria.
  principal boolean not null default false,
  observacoes text,
  created_at timestamptz not null default now()
);

create index idx_fornecedor_contatos_fornecedor on fornecedor_contatos(fornecedor_id);

-- 2) Condições de pagamento — em tabela separada, e o motivo importa.
--
-- `fornecedores` tem a política `any_select_fornecedores`: QUALQUER usuário
-- autenticado lê a linha inteira, porque o portal do cliente precisa do nome
-- do fornecedor nas ordens de compra. RLS no Postgres é por linha, não por
-- coluna — então uma chave pix ou uma condição de prazo guardada ali seria
-- visível ao cliente junto com o nome.
--
-- Dados bancários do fornecedor e o prazo negociado são informação comercial
-- do engenheiro, não do cliente da obra. Por isso vivem aqui, numa tabela que
-- só o engenheiro acessa. É um-para-um com fornecedores, e é assim de
-- propósito: a separação é a proteção.
--
-- Ao mexer nisto: não mova estas colunas de volta para `fornecedores`.

create type condicao_pagamento as enum ('a_vista', 'prazo');

create table fornecedor_pagamento (
  fornecedor_id uuid primary key references fornecedores(id) on delete cascade,
  forma_pagamento forma_pagamento,
  dados_pagamento text,
  condicao_pagamento condicao_pagamento,
  -- Texto livre porque a realidade não cabe num número de dias:
  -- "30/60/90", "28 dias fora a quinzena", "faturado dia 10".
  condicao_prazo text,
  updated_at timestamptz not null default now()
);

alter table fornecedor_contatos enable row level security;
alter table fornecedor_pagamento enable row level security;

create policy eng_all_fornecedor_contatos on fornecedor_contatos
  for all using (is_engenheiro()) with check (is_engenheiro());

create policy eng_all_fornecedor_pagamento on fornecedor_pagamento
  for all using (is_engenheiro()) with check (is_engenheiro());
