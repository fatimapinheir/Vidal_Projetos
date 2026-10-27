-- A categoria de custo passa a viajar no ITEM, não só na ordem.
--
-- Separada da 0067 porque é outra decisão: lá nasceu o catálogo, aqui o item da
-- compra passa a carregar a própria categoria.
--
-- O motivo é o mesmo que faz `descricao` e `unidade` serem copiadas no item em
-- vez de lidas do catálogo por join: o item é o registro do que foi comprado
-- naquele dia. Sem coluna própria, a categoria do item dependeria de
-- `insumos.categoria_custo` — e então apagar o insumo, ou renomeá-lo, mexeria
-- na classificação de uma compra do mês passado. Pior: os itens que não vêm do
-- catálogo (os 64 lançamentos antigos da 0069, e o que o cliente descreve à
-- mão no portal) não teriam categoria nenhuma.
--
-- Com a categoria no item, uma ordem pode ter itens de categorias diferentes —
-- cimento (material) e assentamento (serviço) na mesma nota. `compras.tipo_item`
-- continua existindo como resumo da ordem, deduzido da categoria financeira;
-- nada soma por ele hoje (conferido: é gravado e só relido para repovoar o
-- formulário de edição), então essa convivência não desencontra número.
alter table compra_itens
  add column if not exists categoria_custo text
    check (categoria_custo is null or categoria_custo in ('material', 'servico', 'mao_de_obra'));

-- Nullable, ao contrário de `insumos.categoria_custo`, que é NOT NULL.
--
-- No catálogo, insumo sem categoria não classifica nada e não deve existir. No
-- item, o nulo é a resposta honesta para o que já está gravado sem
-- classificação — inventar "material" para um item antigo seria produzir dado
-- que ninguém afirmou.
comment on column compra_itens.categoria_custo is
  'Categoria de custo do item (material/servico/mao_de_obra), copiada do insumo no momento do lançamento. Cópia, não referência: não muda se o insumo for renomeado ou apagado.';

create index if not exists idx_compra_itens_categoria_custo
  on compra_itens (categoria_custo) where categoria_custo is not null;

-- Herda a categoria da ordem para os itens que já existem.
--
-- Os 6 itens de locação mensal ficam nulos: a ordem deles não tem `tipo_item`
-- (locação conta como Equipamentos, em separado das compras) e não há categoria
-- de custo para herdar. Nulo é o que se sabe sobre eles.
do $$
declare
  v_n integer;
begin
  update compra_itens i
     set categoria_custo = c.tipo_item
    from compras c
   where c.id = i.compra_id
     and i.categoria_custo is null
     and c.tipo_item is not null;

  get diagnostics v_n = row_count;
  raise notice 'Itens que herdaram a categoria de custo da ordem: %', v_n;
end $$;
