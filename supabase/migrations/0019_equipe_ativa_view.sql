-- Contagem de equipe ativa por obra, para o dashboard do cliente.
--
-- O cliente não pode ler `obra_trabalhadores` (é folha de pagamento: nomes e
-- valores de diária). Mas "quantas pessoas estão na minha obra" não é folha —
-- é acompanhamento de investimento, e foi pedido no painel dele.
--
-- Por isso esta é a ÚNICA view do projeto com `security_invoker = false`: ela
-- roda como dona para atravessar a RLS da tabela base e devolver só o
-- agregado. Nenhum nome, nenhum valor, nenhuma linha individual sai daqui —
-- apenas uma contagem por obra.
--
-- A guarda de acesso é o `where` abaixo, e ela é obrigatória: sem ela, uma view
-- security definer entregaria a contagem de TODAS as obras para qualquer
-- autenticado. Ao mexer nesta view, mantenha o predicado.

create view vw_equipe_ativa_obra with (security_invoker = false) as
select
  ot.obra_id,
  count(*)::int as trabalhadores_ativos
from obra_trabalhadores ot
where ot.ativo
  and (is_engenheiro() or cliente_tem_acesso_obra(ot.obra_id))
group by ot.obra_id;

grant select on vw_equipe_ativa_obra to authenticated;
