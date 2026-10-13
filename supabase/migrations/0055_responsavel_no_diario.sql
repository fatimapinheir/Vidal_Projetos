-- Quem responde pela obra, congelado junto com o resto da folha.
--
-- O diário lista o efetivo por nome, e essa lista deixou de ser a resposta
-- útil: numa obra com duas equipes de servente ninguém reconhece os nomes, e a
-- pergunta que se faz olhando a folha é outra — "quantos de cada função
-- estavam lá, e quem estava no comando". A contagem por função já existia no
-- RDO; o que faltava era o nome do responsável.
--
-- Ele sai do cadastro de equipe (`equipes.responsavel_id`) enquanto o dia está
-- aberto. Fechado, precisa estar congelado como os outros: trocar o
-- responsável da equipe em janeiro não pode reescrever quem comandava a obra
-- em outubro. Folha antiga fica com o campo nulo, e aí a linha simplesmente
-- não aparece — melhor que afirmar um nome que ninguém registrou.
alter table diario_obra
  add column if not exists responsaveis_snapshot jsonb;

comment on column diario_obra.responsaveis_snapshot is
  'Nomes dos responsaveis das equipes alocadas, congelados no fechamento. Nulo nas folhas fechadas antes da 0055.';
