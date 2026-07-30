-- Aprovação do cliente passa a ser opcional por ordem de compra: o engenheiro
-- marca explicitamente quando uma compra precisa passar pelo cliente. No fluxo
-- normal (sem marcar), a compra já nasce "aprovada" (self-service do engenheiro),
-- sem travar em "cotada" esperando o cliente.

alter table compras add column requer_aprovacao_cliente boolean not null default false;

-- Compras já existentes nasceram sob o fluxo antigo (sempre exigia aprovação do
-- cliente) — preserva esse contexto histórico.
update compras set requer_aprovacao_cliente = true;
