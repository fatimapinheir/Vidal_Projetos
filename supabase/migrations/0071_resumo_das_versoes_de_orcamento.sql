-- Contagem e total de cada versão do orçamento, sem carregar os itens.
--
-- A tela do orçamento carregava TODOS os itens de TODAS as versões
-- substituídas numa consulta só, para mostrar "227 itens · R$ 486.000" no
-- cabeçalho de um bloco que nasce FECHADO. Na prática: 352 linhas trazidas do
-- banco a cada abertura da tela, e lidas por ninguém.
--
-- Pior que o desperdício é o teto. O PostgREST corta a resposta em 1000 linhas
-- SEM erro e sem aviso. CASA VIDAL ALPHA já tem 438 itens em duas versões; na
-- quinta revisão do orçamento o histórico passaria de 1000 e a tela mostraria
-- menos itens do que existem, com os totais errados, sem ninguém perceber.
-- Número errado na frente do cliente, não lentidão.
--
-- Com esta view o cabeçalho sai de uma linha por versão, e os itens só são
-- buscados quando alguém abre a versão — ver `buscarItensDaVersao`.
--
-- `security_invoker`: a view roda com as permissões de quem consulta, então a
-- RLS de `orcamento_itens` e de `orcamento_versoes` continua valendo. Sem isso
-- ela veria tudo, e o cliente de uma obra leria o orçamento de outra.
create or replace view vw_orcamento_versao_resumo
with (security_invoker = true) as
select v.id          as versao_id,
       v.obra_id,
       v.status,
       count(i.id)   as itens,
       coalesce(sum(i.preco_total), 0) as total
  from orcamento_versoes v
  left join orcamento_itens i on i.orcamento_versao_id = v.id
 group by v.id, v.obra_id, v.status;

comment on view vw_orcamento_versao_resumo is
  'Uma linha por versão de orçamento: quantos itens e quanto soma. Existe para o histórico não carregar os itens de todas as versões só para mostrar contagem e total — ver a 0071.';
