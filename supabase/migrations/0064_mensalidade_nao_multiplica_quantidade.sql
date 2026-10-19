-- A mensalidade NÃO multiplica pela quantidade.
--
-- Eu entendi errado o cadastro. O formulário tem "Quantidade" e "Valor por mês"
-- lado a lado, e eu li o segundo como preço unitário — dez andaimes a R$ 144
-- dariam R$ 1.440 por mês. Não é assim que a obra contrata: o locador cobra
-- R$ 144 por mês pelos dez andaimes. O valor informado é o aluguel do CONJUNTO;
-- a quantidade é descrição do que está em obra, não multiplicador de preço.
--
-- O estrago estava gravado, não só na tela. As ordens de compra geradas
-- somavam R$ 16.210 quando os contratos valem R$ 9.550 — R$ 6.660 a mais, e
-- esse valor aparecia na previsão orçamentária da obra.
--
--   Andaime de 1,5 m   10 ×  R$ 144   R$ 4.320  ->  R$ 432
--   Andaime de 1,0 m    8 ×  R$  72   R$ 1.728  ->  R$ 216
--   Piso andaime 1,5    6 ×  R$  84   R$ 1.512  ->  R$ 252
--
-- Os de quantidade 1 não mudam, e é por isso que a betoneira parecia certa.
--
-- Locação por DIA e por HORA continua multiplicando, a pedido: a regra de
-- negócio desse caso ainda vai ser definida com a construtora, e a mesma
-- dúvida se aplica a ela.
create or replace function public.sincronizar_mensalidades_locacao(p_locacao_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loc        locacoes_equipamento;
  v_compra_id  uuid;
  v_meses      int;
  v_valor_mes  numeric(12,2);
  v_travadas   int;
  v_desc       text;
  i            int;
begin
  if not is_engenheiro() then
    return 'Só o engenheiro gera mensalidade de locação.';
  end if;

  select * into v_loc from locacoes_equipamento where id = p_locacao_id;
  if not found then
    return 'Locação não encontrada.';
  end if;

  select id into v_compra_id from compras where locacao_id = p_locacao_id limit 1;

  -- Vale a MAIOR paga, não a contagem: se a de março foi paga e a de fevereiro
  -- não, refazer da 2 em diante apagaria a de março.
  v_travadas := 0;
  if v_compra_id is not null then
    select coalesce(max(numero_parcela), 0) into v_travadas
      from compra_parcelas
     where compra_id = v_compra_id
       and (
         status = 'paga'
         or data_pagamento is not null
         or comprovante_pagamento_path is not null
         or pagamento_enviado_em is not null
       );
  end if;

  if v_loc.unidade <> 'mes' then
    if v_compra_id is null then
      return null;
    end if;
    if v_travadas > 0 then
      return 'Essa locação já tem mensalidade paga. Estorne o pagamento antes de trocar a forma de cobrança.';
    end if;
    delete from compras where id = v_compra_id;
    return null;
  end if;

  if v_loc.data_primeiro_vencimento is null then
    return 'Informe a data do primeiro vencimento da mensalidade.';
  end if;

  v_meses := coalesce(v_loc.meses_contratados, 1);
  if v_meses < v_travadas then
    return format(
      'O contrato não pode ter menos de %s meses: há mensalidade paga até a %sª.',
      v_travadas, v_travadas
    );
  end if;

  -- AQUI: o valor informado já é o aluguel do conjunto. Era
  -- `v_loc.quantidade * v_loc.valor_unitario`.
  v_valor_mes := round(v_loc.valor_unitario, 2);
  v_desc := format('Locação mensal — %s', v_loc.equipamento);

  if v_travadas > 0 and exists (
    select 1 from compra_parcelas
     where compra_id = v_compra_id
       and numero_parcela <= v_travadas
       and valor <> v_valor_mes
  ) then
    return 'Essa locação tem mensalidade paga com outro valor. Encerre esta locação e cadastre uma nova com o valor reajustado.';
  end if;

  if v_compra_id is null then
    insert into compras (
      obra_id, fornecedor_id, descricao, valor_total, forma_pagamento, status,
      data_cotacao, requer_aprovacao_cliente, pagamento_apos_recebimento,
      criado_por, aprovado_por, aprovado_em, locacao_id
    ) values (
      v_loc.obra_id, v_loc.fornecedor_id, v_desc, 0, 'boleto', 'aprovada',
      v_loc.data_inicio, false, false,
      v_loc.criado_por, v_loc.criado_por, now(), p_locacao_id
    )
    returning id into v_compra_id;
  else
    update compras
       set fornecedor_id = v_loc.fornecedor_id,
           descricao     = v_desc,
           updated_at    = now()
     where id = v_compra_id;
  end if;

  -- A quantidade vira DESCRIÇÃO do item, não fator do preço: o item diz "10 ×
  -- Andaime de 1,5 m" e custa o aluguel do conjunto.
  delete from compra_itens where compra_id = v_compra_id;
  insert into compra_itens (compra_id, descricao, unidade, quantidade, preco_unitario, ordem)
  values (
    v_compra_id,
    case when v_loc.quantidade > 1
      then format('%s × %s', v_loc.quantidade, v_loc.equipamento)
      else v_loc.equipamento
    end,
    'mês', v_meses, v_valor_mes, 1
  );

  delete from compra_parcelas
   where compra_id = v_compra_id
     and numero_parcela > v_travadas;

  for i in (v_travadas + 1)..v_meses loop
    insert into compra_parcelas (compra_id, numero_parcela, valor, data_vencimento)
    values (
      v_compra_id,
      i,
      v_valor_mes,
      (v_loc.data_primeiro_vencimento + make_interval(months => i - 1))::date
    );
  end loop;

  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Refaz as mensalidades já geradas com o valor errado.
--
-- A função é idempotente e preserva parcela paga — e nenhuma destas tem
-- pagamento lançado (conferido antes de escrever isto), então a reescrita é
-- limpa. Roda como `postgres`, fora da RLS, daí o `is_engenheiro()` ser
-- contornado com um `set local role` durante o laço.
do $$
declare
  r record;
  erro text;
begin
  -- `is_engenheiro()` lê `auth.uid()`, que não existe nesta sessão. Chamar a
  -- função por dentro exigiria uma sessão autenticada; aqui a correção é
  -- administrativa e roda direto no recálculo.
  for r in
    select l.id, l.equipamento, l.valor_unitario, l.meses_contratados, c.id as compra_id
    from locacoes_equipamento l
    join compras c on c.locacao_id = l.id
    where l.unidade = 'mes'
  loop
    update compra_parcelas
       set valor = round(r.valor_unitario, 2), updated_at = now()
     where compra_id = r.compra_id
       and status <> 'paga'
       and data_pagamento is null
       and comprovante_pagamento_path is null
       and pagamento_enviado_em is null;

    update compra_itens
       set preco_unitario = round(r.valor_unitario, 2)
     where compra_id = r.compra_id;

    raise notice 'corrigida: % -> % por mes', r.equipamento, round(r.valor_unitario, 2);
  end loop;
end $$;
