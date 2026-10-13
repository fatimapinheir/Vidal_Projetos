-- A função que mantém a ordem de compra de uma locação mensal em dia.
--
-- Mora no banco, e não na Server Action, por um motivo só: ela mexe em três
-- tabelas (compras, compra_itens, compra_parcelas) e um erro no meio deixaria
-- uma ordem sem parcelas na lista de contas a pagar. Aqui é uma transação.
--
-- É IDEMPOTENTE: chamar duas vezes seguidas dá o mesmo resultado. É isso que
-- permite chamá-la de todo caminho que mexe na locação, sem ninguém ter de
-- lembrar em qual deles a mensalidade precisa ser recriada.
--
-- Devolve texto: null quando deu tudo certo, a mensagem para o usuário quando
-- não. Exceção obrigaria a Server Action a inspecionar `message` de erro de
-- banco para distinguir "mês a menos que o já pago" de "o banco caiu".
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
  -- Security definer: sem esta linha, qualquer sessão autenticada criaria
  -- ordem de compra em qualquer obra por este caminho.
  if not is_engenheiro() then
    return 'Só o engenheiro gera mensalidade de locação.';
  end if;

  select * into v_loc from locacoes_equipamento where id = p_locacao_id;
  if not found then
    return 'Locação não encontrada.';
  end if;

  select id into v_compra_id from compras where locacao_id = p_locacao_id limit 1;

  /*
   * Quantas mensalidades já estão intocáveis.
   *
   * Vale a MAIOR paga, não a contagem: se a de março foi paga e a de fevereiro
   * não, refazer da 2 em diante apagaria a de março. Preservar até a última
   * paga mantém a numeração estável, que é o que liga parcela a comprovante.
   */
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

  -- Cobrança por dia ou por hora não tem mensalidade: ali o custo corre pelos
  -- dias, e é `calcularCustoLocacao` que o calcula.
  if v_loc.unidade <> 'mes' then
    if v_compra_id is null then
      return null;
    end if;
    if v_travadas > 0 then
      return 'Essa locação já tem mensalidade paga. Estorne o pagamento antes de trocar a forma de cobrança.';
    end if;
    -- Itens e parcelas caem por cascade.
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

  v_valor_mes := round(v_loc.quantidade * v_loc.valor_unitario, 2);
  v_desc := format('Locação mensal — %s', v_loc.equipamento);

  /*
   * Mudar o valor depois de pagar é recusado, não acomodado.
   *
   * O total da ordem vem de um item único (meses × valor), e as parcelas pagas
   * guardam o valor que tinham no dia. Com valores diferentes, a soma das
   * parcelas deixaria de bater com o total da ordem — a mesma conta que o
   * formulário de ordem de compra exige fechar. Quem precisa reajustar encerra
   * esta locação e cadastra a nova: aí o histórico mostra os dois preços, que
   * é o que de fato aconteceu.
   */
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
      v_loc.obra_id, v_loc.fornecedor_id, v_desc,
      -- Zero: quem escreve `valor_total` é o trigger dos itens, logo abaixo.
      0,
      'boleto', 'aprovada',
      v_loc.data_inicio,
      -- Nem aprovação do cliente nem espera de mercadoria: o contrato de
      -- locação já foi assinado e o equipamento já está na obra. Qualquer das
      -- duas travas deixaria a mensalidade fora de contas a pagar, que é
      -- exatamente o que esta ordem existe para resolver.
      false, false,
      v_loc.criado_por, v_loc.criado_por, now(),
      p_locacao_id
    )
    returning id into v_compra_id;
  else
    update compras
       set fornecedor_id = v_loc.fornecedor_id,
           descricao     = v_desc,
           updated_at    = now()
     where id = v_compra_id;
  end if;

  -- Um item só, com a quantidade de meses. O trigger `trg_compra_itens_recalcula`
  -- deriva `compras.valor_total` dele.
  delete from compra_itens where compra_id = v_compra_id;
  insert into compra_itens (compra_id, descricao, unidade, quantidade, preco_unitario, ordem)
  values (v_compra_id, v_desc, 'mês', v_meses, v_valor_mes, 1);

  delete from compra_parcelas
   where compra_id = v_compra_id
     and numero_parcela > v_travadas;

  for i in (v_travadas + 1)..v_meses loop
    insert into compra_parcelas (compra_id, numero_parcela, valor, data_vencimento)
    values (
      v_compra_id,
      i,
      v_valor_mes,
      -- Soma de meses em date: o Postgres ajusta o dia 31 para o último dia
      -- do mês curto, que é o que o locador faz na nota.
      (v_loc.data_primeiro_vencimento + make_interval(months => i - 1))::date
    );
  end loop;

  return null;
end;
$$;

grant execute on function public.sincronizar_mensalidades_locacao(uuid) to authenticated;

-- Apagar a locação apaga a mensalidade que ninguém pagou.
--
-- A FK é `on delete set null`, para que uma mensalidade PAGA nunca desapareça
-- junto com o cadastro que a originou. Mas o caso comum é o oposto: a locação
-- foi cadastrada errada e é apagada no mesmo dia — e, sem isto, sobrava uma
-- ordem de compra órfã cobrando doze meses de um equipamento que nunca entrou
-- na obra. O gatilho resolve o caso comum e o `set null` continua guardando o
-- caso que importa.
create or replace function public.trg_limpar_mensalidade_da_locacao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from compras c
   where c.locacao_id = old.id
     and not exists (
       select 1 from compra_parcelas p
        where p.compra_id = c.id
          and (
            p.status = 'paga'
            or p.data_pagamento is not null
            or p.comprovante_pagamento_path is not null
            or p.pagamento_enviado_em is not null
          )
     );
  return old;
end;
$$;

drop trigger if exists trg_locacao_limpa_mensalidade on locacoes_equipamento;
create trigger trg_locacao_limpa_mensalidade
  before delete on locacoes_equipamento
  for each row execute function trg_limpar_mensalidade_da_locacao();
