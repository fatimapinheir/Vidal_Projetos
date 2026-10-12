-- Põe as unidades de medida já gravadas na grafia da SINAPI.
--
-- O campo era livre e os dados saíram com 14 grafias para sete unidades:
-- "un"/"UN", "m²"/"M2"/"m2", "m³"/"M3"/"m3", "m"/"M", "kg"/"KG". Não é só
-- estética — a busca de composição na SINAPI casa unidade por igualdade exata
-- (`.eq("unidade", ...)`), então um item em "m²" nunca encontra a composição
-- medida em "M2".
--
-- O formulário já passou a usar lista fechada e a importação de planilha já
-- normaliza na entrada (lib/orcamento/unidades.ts). Isto aqui é o passivo.
--
-- Converte só o que reconhece. Grafia fora do mapa fica como está, de
-- propósito: trocar por um palpite estragaria o dado em silêncio. Em
-- compra_itens existe uma unidade "30" — quantidade digitada no campo errado —
-- e ela sobrevive a esta migração justamente por isso.
--
-- `locacoes_equipamento` fica de fora: usa vocabulário de período (dia, hora,
-- mês) do qual o cálculo de locação depende, e não as unidades de orçamento.

create or replace function pg_temp.unidade_normalizada(bruta text)
returns text
language sql
immutable
as $$
  with limpa as (
    select upper(
      replace(replace(replace(replace(replace(
        btrim(coalesce(bruta, '')),
      '²', '2'), '³', '3'), '.', ''), ' ', ''), '/', '')
    ) as u
  )
  select case
    -- INICIO MAPA
    when u in ('UN','VB','M','M2','M3','KG','T','L','SC','CJ','PAR','JG','CENTO','MIL','MES','H','KWH')
      then u
    when u in ('UNID','UNIDADE','UNIDADES') then 'UN'
    when u in ('METRO','METROS','ML') then 'M'
    when u in ('METROQUADRADO','METROSQUADRADOS') then 'M2'
    when u in ('METROCUBICO','METROSCUBICOS') then 'M3'
    when u in ('QUILO','QUILOGRAMA','QUILOS') then 'KG'
    when u in ('TONELADA','TONELADAS') then 'T'
    when u in ('LITRO','LITROS') then 'L'
    when u in ('SACO','SACOS','SACA') then 'SC'
    when u in ('VERBA') then 'VB'
    when u in ('CONJUNTO','CONJUNTOS') then 'CJ'
    when u in ('HORA','HORAS') then 'H'
    when u in ('MESES','MS','MÊS') then 'MES'
    when u in ('PARES') then 'PAR'
    when u in ('JOGO','JOGOS') then 'JG'
    -- Não reconhecida: devolve null, e quem chama mantém o original.
    else null
    -- FIM MAPA
  end
  from limpa;
$$;

update orcamento_itens
set unidade = pg_temp.unidade_normalizada(unidade)
where pg_temp.unidade_normalizada(unidade) is not null
  and pg_temp.unidade_normalizada(unidade) <> unidade;

update compra_itens
set unidade = pg_temp.unidade_normalizada(unidade)
where pg_temp.unidade_normalizada(unidade) is not null
  and pg_temp.unidade_normalizada(unidade) <> unidade;
