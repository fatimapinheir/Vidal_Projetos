-- Etapas do orçamento como estrutura, e classificação do item.
--
-- Antes a etapa só existia como texto repetido em cada item, então uma etapa
-- sem item nenhum não existia. O template "só etapas" contornava isso criando
-- uma linha falsa por etapa (unidade "vb", quantidade 0) — lixo que o
-- engenheiro tinha de apagar depois e que entrava na contagem de itens.
--
-- Agora a lista de etapas pertence à versão do orçamento. Etapa vazia existe,
-- aparece na tela e pode receber itens; e o `etapa` do item continua sendo o
-- que liga um ao outro.
alter table orcamento_versoes
  add column etapas text[] not null default '{}';

-- Material, serviço ou mão de obra.
--
-- Texto com check, não enum: é classificação de interface, e enum exigiria
-- migração para acrescentar um quarto tipo (equipamento, por exemplo).
alter table orcamento_itens
  add column tipo_item text,
  add constraint orcamento_itens_tipo check (
    tipo_item is null or tipo_item in ('material', 'servico', 'mao_de_obra')
  );
