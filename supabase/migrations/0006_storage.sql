-- Buckets. Convenção de path: sempre {obra_id}/... no primeiro segmento,
-- para as políticas conseguirem checar acesso do cliente àquela obra.
insert into storage.buckets (id, name, public) values
  ('cotacoes', 'cotacoes', false),
  ('comprovantes-pagamento', 'comprovantes-pagamento', false),
  ('comprovantes-fechamento', 'comprovantes-fechamento', false)
on conflict (id) do nothing;

-- engenheiro: acesso total a todos os buckets do app
create policy eng_full_storage on storage.objects for all
  using (
    bucket_id in ('cotacoes', 'comprovantes-pagamento', 'comprovantes-fechamento')
    and is_engenheiro()
  )
  with check (
    bucket_id in ('cotacoes', 'comprovantes-pagamento', 'comprovantes-fechamento')
    and is_engenheiro()
  );

-- cotacoes: cliente só lê (o anexo da cotação é enviado pelo engenheiro)
create policy cli_select_cotacoes on storage.objects for select
  using (
    bucket_id = 'cotacoes'
    and cliente_tem_acesso_obra((storage.foldername(name))[1]::uuid)
  );

-- comprovantes-pagamento: cliente lê e envia (ao marcar uma parcela como paga)
create policy cli_select_comprovantes_pagamento on storage.objects for select
  using (
    bucket_id = 'comprovantes-pagamento'
    and cliente_tem_acesso_obra((storage.foldername(name))[1]::uuid)
  );

create policy cli_insert_comprovantes_pagamento on storage.objects for insert
  with check (
    bucket_id = 'comprovantes-pagamento'
    and cliente_tem_acesso_obra((storage.foldername(name))[1]::uuid)
  );

-- comprovantes-fechamento: dado de folha de pagamento, sem policy de cliente
-- (só o engenheiro acessa, via a policy eng_full_storage acima)
