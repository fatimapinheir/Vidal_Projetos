-- O que cada fornecedor vende, e a razão social ao lado do nome fantasia.
--
-- O cadastro tinha um campo `nome` só, e nada que dissesse o que o fornecedor
-- fornece. Na prática o engenheiro decora: "ferragem é no Aços Longos, tinta é
-- na Maia". Isso não escala e não sobrevive a quem entra na equipe depois.
--
-- CATEGORIA PRÓPRIA, e não `categorias_financeiras`. As duas se chamariam
-- "categoria" e seriam coisas diferentes: a financeira classifica a DESPESA
-- ("Materiais aplicados à obra", "Taxas e licenças") e esta classifica o RAMO
-- do fornecedor ("Aço e ferragens", "Hidráulica"). Forçar as duas na mesma
-- tabela faria o seletor da ordem de compra oferecer "Hidráulica" como
-- categoria financeira.
--
-- MUITOS PARA MUITOS, porque é o caso comum: a mesma loja vende ferragem e
-- material hidráulico, e um empreiteiro faz alvenaria e reboco. Um campo só
-- obrigaria a escolher a categoria "mais ou menos certa" e perderia o resto.
--
-- O tipo (material ou serviço) fica na CATEGORIA, não no fornecedor. Assim um
-- fornecedor que vende material e também presta serviço simplesmente tem
-- categorias dos dois tipos, sem precisar de um campo que contradiga as
-- categorias dele.

create table if not exists categorias_fornecedor (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null check (tipo in ('material', 'servico')),
  ativo boolean not null default true,
  -- Ordem do seletor: as comuns primeiro. As cadastradas depois entram no fim
  -- e se ordenam por nome entre si — mesma regra de `funcoes` (0058).
  ordem int not null default 1000,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_categorias_fornecedor_nome
  on categorias_fornecedor (lower(btrim(nome)));

create table if not exists fornecedor_categorias (
  fornecedor_id uuid not null references fornecedores(id) on delete cascade,
  categoria_id uuid not null references categorias_fornecedor(id) on delete cascade,
  primary key (fornecedor_id, categoria_id)
);

create index if not exists idx_fornecedor_categorias_categoria
  on fornecedor_categorias(categoria_id);

alter table categorias_fornecedor enable row level security;
alter table fornecedor_categorias enable row level security;

-- `(select is_engenheiro())` e não a chamada solta: na forma solta o Postgres
-- reavalia a função POR LINHA. Ver 0059.
create policy eng_all_categorias_fornecedor on categorias_fornecedor
  for all using ((select is_engenheiro())) with check ((select is_engenheiro()));

create policy eng_all_fornecedor_categorias on fornecedor_categorias
  for all using ((select is_engenheiro())) with check ((select is_engenheiro()));

-- ---------------------------------------------------------------------------
-- Razão social ao lado do nome.
--
-- `nome` CONTINUA sendo o nome que o sistema mostra — ele está em ordem de
-- compra, locação, RDO e em mais de vinte lugares, e renomear a coluna seria
-- risco sem ganho. O que ele significa é o nome fantasia: "Casa do Parafuso",
-- e não "Casa do Parafuso Comércio de Ferragens Ltda". A razão social entra ao
-- lado, para a nota fiscal e o pagamento.
alter table fornecedores
  add column if not exists razao_social text;

comment on column fornecedores.nome is
  'Nome fantasia — o que aparece nas telas. Obrigatorio.';
comment on column fornecedores.razao_social is
  'Razao social, para nota fiscal e pagamento. Opcional.';

-- ---------------------------------------------------------------------------
-- Semente: o ramo de quem fornece obra.
insert into categorias_fornecedor (nome, tipo, ordem) values
  ('Cimento e argamassas',       'material', 10),
  ('Agregados (areia, brita)',   'material', 20),
  ('Aço e ferragens',            'material', 30),
  ('Madeiras e formas',          'material', 40),
  ('Material hidráulico',        'material', 50),
  ('Material elétrico',          'material', 60),
  ('Revestimentos e pisos',      'material', 70),
  ('Tintas e impermeabilizantes','material', 80),
  ('Esquadrias e vidros',        'material', 90),
  ('Telhas e coberturas',        'material', 100),
  ('Gesso e drywall',            'material', 110),
  ('Louças e metais',            'material', 120),
  ('Ferramentas e EPI',          'material', 130),
  ('Locação de equipamentos',    'servico',  140),
  ('Concreto usinado',           'servico',  150),
  ('Terraplanagem',              'servico',  160),
  ('Mão de obra e empreitada',   'servico',  170),
  ('Projetos e consultoria',     'servico',  180),
  ('Transporte e frete',         'servico',  190),
  ('Serviços gerais',            'servico',  200)
on conflict (lower(btrim(nome))) do update
  set tipo = excluded.tipo, ordem = excluded.ordem, ativo = true;
