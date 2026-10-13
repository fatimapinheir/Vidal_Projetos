-- O catálogo de funções, curado — e numa ordem que não é a alfabética.
--
-- A 0057 semeou as funções a partir do texto livre que havia em
-- `trabalhadores.funcao`, e o que havia era o problema: "Mestre de Obra" e
-- "Mestre de obras" convivendo, "engenheiro" em minúscula, "pedreuri". Semear
-- com o existente foi o certo para não perder nada; curar depois é o passo que
-- faltava.
--
-- A lista agora é a que o engenheiro usa na obra, na ordem em que ele a
-- recita: pedreiro, ajudante, mestre — não "ajudante, armador, betoneiro".
-- Alfabética é a ordem de quem procura numa lista que não conhece; esta é para
-- quem abre o seletor dez vezes por dia e quer o item comum no topo.
alter table funcoes add column if not exists ordem int not null default 1000;

comment on column funcoes.ordem is
  'Ordem no seletor. As cadastradas depois entram no fim (1000) e se ordenam por nome entre si.';

-- ---------------------------------------------------------------------------
-- 1. Normaliza o que já existe, antes de apagar o que sobra.
--
-- Renomear primeiro faz as duplicatas colidirem pelo nome canônico, e aí a
-- remoção do passo 2 sabe o que é duplicata de quê. O índice único é sobre
-- `lower(btrim(nome))`, então trocar a caixa não esbarra nele.
update funcoes set nome = 'Engenheiro'      where lower(btrim(nome)) = 'engenheiro';
update funcoes set nome = 'Mestre de obra'  where lower(btrim(nome)) = 'mestre de obra';

-- ---------------------------------------------------------------------------
-- 2. Funde as variações na forma canônica.
--
-- Os lançamentos que apontam para a variação passam a apontar para a boa. Onde
-- o mesmo dia já tiver as duas, as quantidades se SOMAM — são contagens de
-- pessoas, e duas linhas de mestre no mesmo dia querem dizer o total delas.
-- Sem este passo, apagar a variação esbarraria na chave estrangeira.
with equivalencias as (
  select v.id as de, c.id as para
  from (values
    ('mestre de obras', 'mestre de obra'),
    ('pedreuri', 'pedreiro')
  ) as mapa(variacao, canonica)
  join funcoes v on lower(btrim(v.nome)) = mapa.variacao
  join funcoes c on lower(btrim(c.nome)) = mapa.canonica
),
somadas as (
  select e.diario_id, eq.para as funcao_id, sum(e.quantidade)::int as quantidade
  from diario_efetivo_funcoes e
  join equivalencias eq on eq.de = e.funcao_id
  group by e.diario_id, eq.para
),
apagadas as (
  delete from diario_efetivo_funcoes e
  using equivalencias eq
  where e.funcao_id = eq.de
  returning 1
)
insert into diario_efetivo_funcoes (diario_id, funcao_id, quantidade)
select diario_id, funcao_id, quantidade from somadas
on conflict (diario_id, funcao_id)
  do update set quantidade = diario_efetivo_funcoes.quantidade + excluded.quantidade,
                updated_at = now();

delete from funcoes where lower(btrim(nome)) in ('mestre de obras', 'pedreuri');

-- ---------------------------------------------------------------------------
-- 3. A lista final, com a ordem do seletor.
--
-- `on conflict` sobre o índice de nome: as que já existiam só ganham a ordem,
-- as que faltavam entram. Nenhuma função fora desta lista é apagada — se o
-- engenheiro cadastrou "Soldador" ontem, ele continua lá, no fim do seletor.
insert into funcoes (nome, ordem) values
  ('Pedreiro', 10),
  ('Ajudante', 20),
  ('Mestre de obra', 30),
  ('Betoneiro', 40),
  ('Meia colher', 50),
  ('Engenheiro', 60),
  ('Bombeiro', 70),
  ('Eletricista', 80),
  ('Carpinteiro', 90),
  ('Ferreiro', 100),
  ('Armador', 110),
  ('Gesseiro', 120)
on conflict (lower(btrim(nome))) do update
  set ordem = excluded.ordem,
      nome = excluded.nome,
      ativo = true;
