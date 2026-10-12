-- Cadastro da obra: localização estruturada, dados municipais e características.
--
-- Três mudanças que valem explicação:
--
-- 1. `tipo` (enum residencial/comercial) vira tabela. O engenheiro precisa criar
--    tipos novos pela tela, e enum não aceita isso sem migração a cada valor.
--    Os dois valores atuais viram as duas primeiras linhas, e as obras
--    existentes são religadas antes de a coluna antiga cair.
--
-- 2. `endereco` (texto livre) é substituído pelos campos separados. A decisão de
--    não migrar o texto antigo foi do usuário: o que havia era um fragmento
--    ("Cidade Alpha") que não se encaixa em nenhum campo específico.
--
-- 3. Categoria, padrão de acabamento e faixa ficam como `text`, não como enum
--    nem check. São listas que ainda vão mudar enquanto o fluxo se assenta, e
--    cada ajuste custaria uma migração. A validação mora no zod da action, que
--    é uma linha para alterar. Setor/quadra/lote e afins também são texto
--    porque cada prefeitura formata do seu jeito.

create table obra_tipos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  created_at timestamptz not null default now()
);

alter table obra_tipos enable row level security;
-- Mesmo critério de fornecedores: lista de apoio, não é dado sensível.
create policy eng_all_obra_tipos on obra_tipos for all using (is_engenheiro()) with check (is_engenheiro());
create policy any_select_obra_tipos on obra_tipos for select using (auth.role() = 'authenticated');

insert into obra_tipos (nome) values ('Residencial'), ('Comercial');

alter table obras
  -- Localização
  add column cep text,
  add column logradouro text,
  add column numero text,
  add column complemento text,
  add column bairro text,
  add column cidade text,
  add column uf text,
  add column link_maps text,
  -- Dados municipais (habite-se / alvará)
  add column setor text,
  add column quadra text,
  add column lote text,
  add column cadastro_municipal text,
  add column alvara_construcao text,
  add column art_rrt_execucao text,
  add column cno text,
  -- Características
  add column categoria text not null default 'Obra de construção',
  -- set null, não cascade: apagar um tipo não pode levar a obra junto.
  add column tipo_obra_id uuid references obra_tipos(id) on delete set null,
  add column metragem_quadrada numeric(10,2),
  add column padrao_acabamento text,
  add column faixa text,
  add column quartos integer not null default 0,
  add column suites integer not null default 0,
  add column banheiros integer not null default 0,
  add column financiada boolean not null default false;

alter table obras
  add constraint obras_uf_duas_letras check (uf is null or char_length(uf) = 2),
  add constraint obras_metragem_positiva check (metragem_quadrada is null or metragem_quadrada >= 0),
  add constraint obras_comodos_nao_negativos check (quartos >= 0 and suites >= 0 and banheiros >= 0);

-- Religa as obras existentes ao tipo equivalente ANTES de derrubar a coluna.
update obras o
   set tipo_obra_id = t.id
  from obra_tipos t
 where t.nome = initcap(o.tipo::text);

alter table obras drop column tipo;
alter table obras drop column endereco;
drop type obra_tipo;

create index idx_obras_tipo_obra on obras(tipo_obra_id);
