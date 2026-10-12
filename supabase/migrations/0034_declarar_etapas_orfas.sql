-- Conserta versões de orçamento cujas etapas existiam apenas nos itens.
--
-- A etapa do orçamento vive em dois lugares: declarada em
-- `orcamento_versoes.etapas` e escrita em cada item. A tela desenha a união dos
-- dois, mas só a declaração sustenta uma etapa sem item — e nenhum caminho de
-- escrita garantia que uma etapa citada por um item fosse declarada.
--
-- Resultado: etapa vinda do template de serviços (ou de planilha importada)
-- ficava "órfã", e apagar o último item dela fazia a etapa desaparecer da tela.
-- No meio da montagem de um orçamento isso é o oposto do esperado: esvaziar uma
-- etapa para refazê-la é trabalho normal, não um pedido para apagá-la.
--
-- O código já passou a declarar etapa em toda escrita de item. Isto aqui é só o
-- passivo: as versões que já estão no banco.
--
-- Estritamente aditivo — nenhuma etapa declarada é removida, nenhuma duplicada.
-- A ordem de entrada segue a ordem dos itens, e não a alfabética, senão
-- "10. Esquadrias" cairia antes de "2. Fundações".
with faltando as (
  select
    i.orcamento_versao_id as versao_id,
    array_agg(i.etapa order by i.primeira_ordem) as nomes
  from (
    select orcamento_versao_id, etapa, min(ordem) as primeira_ordem
    from orcamento_itens
    where etapa is not null and btrim(etapa) <> ''
    group by orcamento_versao_id, etapa
  ) i
  join orcamento_versoes v on v.id = i.orcamento_versao_id
  where not (i.etapa = any(v.etapas))
  group by i.orcamento_versao_id
)
update orcamento_versoes v
set etapas = v.etapas || f.nomes
from faltando f
where f.versao_id = v.id;
