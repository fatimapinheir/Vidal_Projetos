-- Põe em ordem as etapas declaradas pela 0034.
--
-- A 0034 anexou as etapas órfãs na ordem em que os itens apareciam, e num
-- rascunho já mexido isso saiu como "3, 4, ... 12, 2, 1" — a ordem do array é a
-- ordem que a tela desenha, então o roteiro ficava embaralhado.
--
-- Só toca em versão cujas etapas são TODAS numeradas no padrão "<n>. Nome", que
-- é o dos templates. Nome fora desse padrão não tem ordem dedutível, e
-- reordenar por alfabeto estragaria a sequência que o engenheiro escolheu.
with numeradas as (
  select v.id
  from orcamento_versoes v
  where cardinality(v.etapas) > 0
    and not exists (
      select 1 from unnest(v.etapas) as e
      where e !~ '^[0-9]+\.'
    )
),
ordenadas as (
  select
    v.id,
    array_agg(e order by (regexp_match(e, '^([0-9]+)\.'))[1]::int) as etapas
  from orcamento_versoes v
  join numeradas n on n.id = v.id
  cross join unnest(v.etapas) as e
  group by v.id
)
update orcamento_versoes v
set etapas = o.etapas
from ordenadas o
where o.id = v.id and v.etapas <> o.etapas;
