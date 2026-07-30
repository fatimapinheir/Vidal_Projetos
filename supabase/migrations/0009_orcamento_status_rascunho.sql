-- Precisa estar em sua própria migration/transação: um novo valor de enum não
-- pode ser usado (ex: em DEFAULT de outra tabela) na mesma transação em que foi criado.
alter type orcamento_versao_status add value 'rascunho';
