-- profiles
alter table profiles enable row level security;
create policy eng_all_profiles on profiles for all using (is_engenheiro()) with check (is_engenheiro());
create policy cli_select_own_profile on profiles for select using (id = auth.uid());

-- obras
alter table obras enable row level security;
create policy eng_all_obras on obras for all using (is_engenheiro()) with check (is_engenheiro());
create policy cli_select_obras on obras for select using (cliente_tem_acesso_obra(id));

-- obra_clientes
alter table obra_clientes enable row level security;
create policy eng_all_obra_clientes on obra_clientes for all using (is_engenheiro()) with check (is_engenheiro());
create policy cli_select_obra_clientes on obra_clientes for select using (cliente_id = auth.uid());

-- fornecedores (dado não sensível: leitura liberada a qualquer autenticado; escrita só engenheiro)
alter table fornecedores enable row level security;
create policy eng_all_fornecedores on fornecedores for all using (is_engenheiro()) with check (is_engenheiro());
create policy any_select_fornecedores on fornecedores for select using (auth.role() = 'authenticated');

-- trabalhadores (dado de folha de pagamento: só engenheiro, cliente não acessa)
alter table trabalhadores enable row level security;
create policy eng_all_trabalhadores on trabalhadores for all using (is_engenheiro()) with check (is_engenheiro());

-- obra_trabalhadores (idem: só engenheiro)
alter table obra_trabalhadores enable row level security;
create policy eng_all_obra_trabalhadores on obra_trabalhadores for all using (is_engenheiro()) with check (is_engenheiro());

-- presencas (idem: só engenheiro)
alter table presencas enable row level security;
create policy eng_all_presencas on presencas for all using (is_engenheiro()) with check (is_engenheiro());

-- fechamentos_periodo (idem: só engenheiro)
alter table fechamentos_periodo enable row level security;
create policy eng_all_fechamentos on fechamentos_periodo for all using (is_engenheiro()) with check (is_engenheiro());

-- compras
alter table compras enable row level security;
create policy eng_all_compras on compras for all using (is_engenheiro()) with check (is_engenheiro());
create policy cli_select_compras on compras for select using (cliente_tem_acesso_obra(obra_id));
-- sem policy de insert/update/delete para cliente: mudanças de status passam pelas RPCs (0005)

-- compra_parcelas
alter table compra_parcelas enable row level security;
create policy eng_all_parcelas on compra_parcelas for all using (is_engenheiro()) with check (is_engenheiro());
create policy cli_select_parcelas on compra_parcelas for select using (
  exists (select 1 from compras c where c.id = compra_id and cliente_tem_acesso_obra(c.obra_id))
);
