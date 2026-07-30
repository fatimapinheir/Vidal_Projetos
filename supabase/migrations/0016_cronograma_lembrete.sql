-- Lembrete por tarefa: quantos dias antes do início calculado o engenheiro
-- quer ser avisado (ex: concretagem precisa avisar 15 dias antes pra agendar
-- fornecedor). Só um sinal visual dentro do próprio app por enquanto — a data
-- de alerta é derivada de data_inicio_cedo, não armazenada, pra acompanhar
-- automaticamente qualquer recálculo do cronograma.

alter table cronograma_tarefas add column lembrete_dias_antes int;
alter table cronograma_tarefas add constraint chk_lembrete_dias_antes
  check (lembrete_dias_antes is null or lembrete_dias_antes > 0);
