-- Os itens das versões que a tela do orçamento mostra, com a obra junto.
--
-- A tela fazia duas idas ao banco em fila: primeiro as versões, depois os
-- itens DAQUELAS versões. A segunda só podia começar quando a primeira
-- voltasse com o id — e cada espera custa 431 ms, medidos em produção, porque
-- a função da Netlify roda em IAD (Virgínia) e o Postgres está em São Paulo.
--
-- A dependência era de forma, não de necessidade: em vez de "os itens da
-- versão X", dá para pedir "os itens das versões vigentes DESTA OBRA". Esta
-- view carrega `obra_id` e `status`, então a consulta entra no mesmo lote das
-- outras e a tela passa a esperar uma vez em vez de duas.
--
-- Por que view e não join embutido do PostgREST: `database.types.ts` é
-- mantido à mão neste projeto e declara `Relationships: []`, então o
-- TypeScript não consegue tipar um embed. View é relação comum — tipa como
-- qualquer tabela.
--
-- Só ativa e rascunho: são as duas que a tela desenha. O histórico já vem de
-- `vw_orcamento_versao_resumo`, e os itens dele são buscados quando alguém
-- abre a versão.
--
-- `security_invoker`: roda com as permissões de quem consulta, então a RLS de
-- `orcamento_itens` e `orcamento_versoes` continua valendo. Sem isso a view
-- veria tudo, e o cliente de uma obra leria o orçamento de outra.
create or replace view vw_orcamento_itens_vigentes
with (security_invoker = true) as
select i.id,
       i.orcamento_versao_id,
       v.obra_id,
       v.status,
       i.codigo_sinapi,
       i.descricao,
       i.unidade,
       i.quantidade,
       i.preco_unitario,
       i.preco_total,
       i.etapa,
       i.tipo_item,
       i.ordem
  from orcamento_itens i
  join orcamento_versoes v on v.id = i.orcamento_versao_id
 where v.status in ('ativa', 'rascunho');

comment on view vw_orcamento_itens_vigentes is
  'Itens das versões ativa e rascunho, com obra_id e status. Existe para a tela do orçamento pedir os itens sem antes descobrir o id da versão — eram duas idas ao banco em fila. Ver a 0073.';
