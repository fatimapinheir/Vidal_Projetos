-- Passa os orçamentos existentes para a lista única de etapas numeradas.
--
-- Até aqui conviviam duas listas: as 22 etapas em MAIÚSCULAS da planilha do
-- engenheiro (template "só etapas") e 12 nomes numerados em caixa mista
-- (template "etapas + materiais"), sem um nome em comum. Aplicar os dois no
-- mesmo rascunho somava 34 grupos, com cara de dois orçamentos embaralhados.
--
-- A lista agora é uma só, numerada, com 23 etapas — as 22 da planilha mais
-- "06. COBERTURA", que faltava e não tinha onde pôr os serviços de telhado.
-- Os templates passaram a declarar essa mesma lista; a diferença entre eles é
-- apenas quais itens trazem.
--
-- Isto aqui é o passivo: as duas versões que já existem no banco. Sem o
-- remapeamento, aplicar um template num rascunho de nomes antigos recriaria a
-- mistura.
--
-- O mapa é por etapa, com exceções por descrição onde uma etapa antiga se parte
-- em duas ou três (hidrossanitárias viram água fria + esgoto + louças, por
-- exemplo). Nenhum item muda de descrição, quantidade ou preço — só de etapa.

-- Itens: a etapa de cada um.
update orcamento_itens i
set etapa = novo.destino
from (
  select
    id,
    -- INICIO CASE
    case
      when etapa ilike '1.%preliminares%' then '01. SERVIÇOS PRELIMINARES'

      -- Fundações se parte: a impermeabilização do baldrame tem etapa própria.
      when etapa ilike '2.%funda%' and descricao ilike '%impermeabiliza%'
        then '09. IMPERMEABILIZAÇÃO'
      when etapa ilike '2.%funda%' then '03. INFRA-ESTRUTURA'

      when etapa ilike '3.%superestrutura%' then '04. SUPRA-ESTRUTURA'
      when etapa ilike '4.%alvenaria%' then '05. PAREDES E PAINEIS'
      when etapa ilike '5.%cobertura%' then '06. COBERTURA'

      -- Hidrossanitárias se parte em três: a planilha separa água fria, esgoto
      -- e as peças.
      when etapa ilike '6.%hidrossanit%' and descricao ilike '%água fria%'
        then '17. INSTALAÇÃO ÁGUA FRIA'
      when etapa ilike '6.%hidrossanit%' and descricao ilike '%esgoto%'
        then '20. INSTALAÇÃO ESGOTO E PLUVIAL'
      when etapa ilike '6.%hidrossanit%' then '21. LOUÇAS E METAIS'

      when etapa ilike '7.%elétricas%' then '16. INSTALAÇÃO ELÉTRICA'
      when etapa ilike '8.%revestimentos%' then '10. REVESTIMENTOS INTERNOS'
      when etapa ilike '9.%pisos%' then '13. PISOS'

      -- Esquadrias se parte por material. O item de janela desta base é uma
      -- esquadria de MADEIRA (a composição que a SINAPI devolveu), mas ele
      -- ocupa o lugar de "Janela de alumínio" no template — vai para alumínio
      -- junto com o slot, e fica anotado para o engenheiro decidir.
      when etapa ilike '10.%esquadrias%' and descricao ilike 'PORTA%'
        then '07. ESQUADRIAS DE MADEIRA'
      when etapa ilike '10.%esquadrias%' and descricao ilike '%porta interna%'
        then '07. ESQUADRIAS DE MADEIRA'
      when etapa ilike '10.%esquadrias%' then '08. ESQUADRIAS DE ALUMÍNIO'

      when etapa ilike '11.%pintura%' then '14. PINTURA'

      -- "Louças, metais e limpeza" se parte: bancada é pedra, limpeza é
      -- complemento.
      when etapa ilike '12.%lou%' and descricao ilike '%limpeza%'
        then '23. COMPLEMENTOS E OUTROS SERVIÇOS'
      when etapa ilike '12.%lou%' and descricao ilike '%bancada%'
        then '15. GRANITOS E MÁRMORES'
      when etapa ilike '12.%lou%' then '21. LOUÇAS E METAIS'

      -- Nomes que já estão na lista nova, ou etapa nula: ficam como estão.
      else etapa
    end
    -- FIM CASE
    as destino
  from orcamento_itens
) novo
where novo.id = i.id and coalesce(novo.destino, '') <> coalesce(i.etapa, '');

-- Versões: o array de etapas declaradas passa a ser o das etapas que seus
-- próprios itens usam, na ordem numérica. Etapa declarada que não sobrou em
-- item nenhum sai — no estado atual, todas as declaradas vinham dos itens.
with destino as (
  select
    i.orcamento_versao_id as versao_id,
    array_agg(distinct i.etapa) as nomes
  from orcamento_itens i
  where i.etapa is not null and btrim(i.etapa) <> ''
  group by i.orcamento_versao_id
),
ordenado as (
  select
    d.versao_id,
    array_agg(e order by (regexp_match(e, '^([0-9]+)\.'))[1]::int) as nomes
  from destino d
  cross join unnest(d.nomes) as e
  where e ~ '^[0-9]+\.'
  group by d.versao_id
)
update orcamento_versoes v
set etapas = o.nomes
from ordenado o
where o.versao_id = v.id and v.etapas <> o.nomes;

-- Ordens de compra vinculadas a etapa seguem o mesmo mapa. Hoje nenhuma está
-- vinculada, mas deixar fora criaria vínculo apontando para nome que não existe
-- mais assim que a primeira fosse classificada.
update compras
set orcamento_etapa = case
  when orcamento_etapa ilike '1.%preliminares%' then '01. SERVIÇOS PRELIMINARES'
  when orcamento_etapa ilike '2.%funda%' then '03. INFRA-ESTRUTURA'
  when orcamento_etapa ilike '3.%superestrutura%' then '04. SUPRA-ESTRUTURA'
  when orcamento_etapa ilike '4.%alvenaria%' then '05. PAREDES E PAINEIS'
  when orcamento_etapa ilike '5.%cobertura%' then '06. COBERTURA'
  when orcamento_etapa ilike '6.%hidrossanit%' then '17. INSTALAÇÃO ÁGUA FRIA'
  when orcamento_etapa ilike '7.%elétricas%' then '16. INSTALAÇÃO ELÉTRICA'
  when orcamento_etapa ilike '8.%revestimentos%' then '10. REVESTIMENTOS INTERNOS'
  when orcamento_etapa ilike '9.%pisos%' then '13. PISOS'
  when orcamento_etapa ilike '10.%esquadrias%' then '07. ESQUADRIAS DE MADEIRA'
  when orcamento_etapa ilike '11.%pintura%' then '14. PINTURA'
  when orcamento_etapa ilike '12.%lou%' then '21. LOUÇAS E METAIS'
  else orcamento_etapa
end
where orcamento_etapa is not null;
