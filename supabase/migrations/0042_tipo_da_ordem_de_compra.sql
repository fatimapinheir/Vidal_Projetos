-- Tipo da ordem de compra: material, serviço ou mão de obra.
--
-- A ordem já diz quanto custa, de quem é e a que etapa pertence — faltava
-- dizer o QUE é. Sem isso, a tela de lançamentos do cliente não consegue
-- separar "cimento" de "alvenaria contratada", que é a primeira coisa que ele
-- pergunta ao olhar a lista.
--
-- Mesmos três valores e mesmo formato de `orcamento_itens.tipo_item` (texto
-- com check, não enum): os dois precisam casar para o comparativo orçado ×
-- comprado por tipo fazer sentido, e um enum novo só para esta coluna daria
-- dois vocabulários para a mesma ideia.
--
-- Nulo é permitido e não tem backfill. As ordens que já existem não têm como
-- ser classificadas sem chute — nenhuma delas sequer aponta para uma etapa do
-- orçamento. A tela trata ausência como ausência, e o engenheiro preenche
-- daqui para frente.
alter table compras
  add column if not exists tipo_item text,
  add constraint compras_tipo_item_check
    check (tipo_item is null or tipo_item in ('material', 'servico', 'mao_de_obra'));

comment on column compras.tipo_item is
  'O que a ordem compra: material, servico ou mao_de_obra. Mesmo vocabulário de orcamento_itens.tipo_item.';
