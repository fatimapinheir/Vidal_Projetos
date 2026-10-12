-- Fornecedor inativo em vez de excluído.
--
-- Excluir não é opção: fornecedor aparece em ordem de compra e em locação, e
-- apagar levaria o histórico junto (ou quebraria a referência). Inativar tira
-- da lista de escolha sem tocar no que já foi comprado dele — mesmo caminho já
-- usado em equipes.
alter table fornecedores
  add column ativo boolean not null default true;

-- As listas de seleção filtram por ativo e ordenam por nome.
create index idx_fornecedores_ativo on fornecedores(ativo, nome);
