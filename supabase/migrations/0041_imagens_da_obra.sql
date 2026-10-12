-- Imagens da obra: a capa (faixa de saudação do portal) e a foto do RDO.
--
-- Duas colunas e não uma galeria: cada imagem tem um lugar fixo na tela e um
-- recorte próprio. Galeria genérica obrigaria a tela a escolher qual foto usar
-- em cada lugar, e essa escolha é do engenheiro.
--
-- Guardamos o PATH do Storage, não a URL: o bucket é privado e a URL é
-- assinada na hora de renderizar, com validade curta.
alter table obras
  add column if not exists imagem_capa_path text,
  add column if not exists imagem_rdo_path text;

comment on column obras.imagem_capa_path is
  'Foto da obra na faixa de saudação do portal do cliente. Paisagem, recortada ao centro.';
comment on column obras.imagem_rdo_path is
  'Foto no cabeçalho do cartão de RDO do portal. Paisagem, recortada à direita.';

-- Convenção de path do bucket: {obra_id}/... no primeiro segmento, igual aos
-- outros — é o que deixa a policy do cliente checar acesso àquela obra.
insert into storage.buckets (id, name, public) values ('obra-imagens', 'obra-imagens', false)
on conflict (id) do nothing;

create policy eng_full_obra_imagens on storage.objects for all
  using (bucket_id = 'obra-imagens' and is_engenheiro())
  with check (bucket_id = 'obra-imagens' and is_engenheiro());

-- O cliente só lê, e só da obra dele. Não há insert de cliente aqui: a foto
-- que aparece no portal é escolha de quem conduz a obra.
create policy cli_select_obra_imagens on storage.objects for select
  using (
    bucket_id = 'obra-imagens'
    and cliente_tem_acesso_obra((storage.foldername(name))[1]::uuid)
  );
