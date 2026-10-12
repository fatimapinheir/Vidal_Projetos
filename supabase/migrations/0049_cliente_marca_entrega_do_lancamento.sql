-- O cliente marca como entregue o lançamento que ele mesmo registrou.

-- ---------------------------------------------------------------------------
-- Por que função, e não policy de update
--
-- RLS não enxerga coluna: uma policy `update` em `compras` para o cliente
-- autorizaria a linha inteira, e o `with check` só olha o resultado — não dá
-- para dizer "pode mexer em data_entrega_real e em mais nada". Na prática o
-- cliente passaria a poder reescrever valor, descrição e status do próprio
-- lançamento, e o custo da obra deixaria de ser confiável.
--
-- Então: nenhuma policy de update, e uma porta estreita. A função roda como
-- dona da tabela (ignora RLS), confere ela mesma quem está chamando e toca
-- exatamente três colunas. Mesmo desenho de `aprovar_e_pagar_parcela` (0020).
-- ---------------------------------------------------------------------------
create or replace function public.cli_marcar_entrega_lancamento(
  p_compra_id uuid,
  p_entregue boolean
)
returns void language plpgsql security definer set search_path = public as $$
declare v_obra_id uuid;
begin
  -- As três condições de uma vez: existe, é lançamento, e é dele. Separar em
  -- mensagens diferentes contaria a quem tentar o que existe do outro lado.
  select obra_id into v_obra_id
  from compras
  where id = p_compra_id
    and eh_lancamento
    and criado_por = auth.uid();

  if v_obra_id is null then
    raise exception 'Lançamento não encontrado ou não registrado por você';
  end if;

  if not cliente_tem_acesso_obra(v_obra_id) and not is_engenheiro() then
    raise exception 'Acesso negado';
  end if;

  update compras set
    -- Data no fuso da obra, não `current_date`: o banco roda em UTC e às 21h
    -- de Brasília já virou o dia lá — a entrega de hoje seria gravada como
    -- amanhã. Mesmo motivo de lib/fuso.ts na aplicação.
    data_entrega_real =
      case when p_entregue then (now() at time zone 'America/Sao_Paulo')::date end,
    recebimento_confirmado_por = case when p_entregue then auth.uid() end,
    recebimento_confirmado_em = case when p_entregue then now() end,
    updated_at = now()
  where id = p_compra_id;
end;
$$;

grant execute on function public.cli_marcar_entrega_lancamento(uuid, boolean) to authenticated;
