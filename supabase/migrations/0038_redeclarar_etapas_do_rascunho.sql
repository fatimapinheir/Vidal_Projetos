-- Redeclara as etapas das versões cujo array ficou vazio.
--
-- O "Editar orçamento" (antigo "Criar nova revisão") copiava os itens da versão
-- ativa para o rascunho novo, mas não copiava `orcamento_versoes.etapas`. O
-- rascunho nascia com 227 itens e zero etapas declaradas — e no diálogo de
-- editar item o select de etapa listava só "Sem etapa". Como a etapa do item
-- não estava entre as opções, salvar o item a apagava.
--
-- A causa está corrigida em `criarRascunho`, que agora leva as etapas junto, e
-- o select passou a incluir a etapa atual mesmo fora da lista. Isto aqui é o
-- rascunho que já está no banco nesse estado.
--
-- Mesma operação das migrações 0034 e 0035, numa só: declarar o que os itens
-- usam e ordenar pela numeração. Aditivo e idempotente — rodar de novo não
-- muda nada.
with usadas as (
  select
    i.orcamento_versao_id as versao_id,
    i.etapa,
    min(i.ordem) as primeira_ordem
  from orcamento_itens i
  join orcamento_versoes v on v.id = i.orcamento_versao_id
  where i.etapa is not null
    and btrim(i.etapa) <> ''
    and not (i.etapa = any(v.etapas))
  group by i.orcamento_versao_id, i.etapa
),
novas as (
  select versao_id, array_agg(etapa order by primeira_ordem) as nomes
  from usadas
  group by versao_id
)
update orcamento_versoes v
set etapas = v.etapas || n.nomes
from novas n
where n.versao_id = v.id;

-- Ordena pela numeração quando TODAS as etapas da versão são numeradas, que é
-- o padrão dos templates. Nome fora desse padrão não tem ordem dedutível, e
-- reordenar por alfabeto estragaria a sequência escolhida à mão.
with numeradas as (
  select v.id
  from orcamento_versoes v
  where cardinality(v.etapas) > 0
    and not exists (
      select 1 from unnest(v.etapas) as e where e !~ '^[0-9]+\.'
    )
),
ordenadas as (
  select v.id, array_agg(e order by (regexp_match(e, '^([0-9]+)\.'))[1]::int) as etapas
  from orcamento_versoes v
  join numeradas n on n.id = v.id
  cross join unnest(v.etapas) as e
  group by v.id
)
update orcamento_versoes v
set etapas = o.etapas
from ordenadas o
where o.id = v.id and v.etapas <> o.etapas;
