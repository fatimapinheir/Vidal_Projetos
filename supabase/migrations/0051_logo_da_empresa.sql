-- A logo da empresa que opera o sistema, no topo do menu.

-- ---------------------------------------------------------------------------
-- Bucket PÚBLICO, ao contrário do de assinaturas
--
-- A assinatura do responsável técnico é documento: fica em bucket privado e
-- sai por URL assinada, lida no servidor com a chave de serviço porque a RLS
-- não entrega o arquivo de um usuário a outro (ver lib/diario/carregar-rdo).
--
-- A logo é o oposto: existe para ser vista. Deixá-la privada custaria o mesmo
-- rodeio — leitura administrativa e URL que expira — para proteger uma marca
-- que a empresa estampa em papel timbrado. Pública, o <img> aponta direto, o
-- navegador guarda em cache e não há link vencendo no meio da sessão do
-- cliente.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('logos', 'logos', true)
on conflict (id) do nothing;

-- Quem escreve é só o engenheiro; ler, qualquer um — é o que "público"
-- significa, e é o que faz o cliente enxergar a marca no portal dele.
drop policy if exists eng_insert_logos on storage.objects;
create policy eng_insert_logos on storage.objects for insert
  with check (bucket_id = 'logos' and is_engenheiro());

drop policy if exists eng_update_logos on storage.objects;
create policy eng_update_logos on storage.objects for update
  using (bucket_id = 'logos' and is_engenheiro());

drop policy if exists eng_delete_logos on storage.objects;
create policy eng_delete_logos on storage.objects for delete
  using (bucket_id = 'logos' and is_engenheiro());

-- ---------------------------------------------------------------------------
-- Onde o caminho mora
--
-- No perfil do engenheiro, junto de `assinatura_path`, e não numa tabela de
-- configuração: é o mesmo tipo de dado — um arquivo que pertence a quem
-- responde pela obra — e quem envia é a mesma pessoa, na mesma tela.
-- ---------------------------------------------------------------------------
alter table profiles add column if not exists logo_path text;

comment on column profiles.logo_path is
  'Caminho da logo da empresa no bucket público `logos`. Aparece no topo do menu, para o engenheiro e para os clientes dele.';

-- ---------------------------------------------------------------------------
-- O caminho da logo, para quem não pode ler `profiles` do engenheiro
--
-- A RLS entrega ao cliente só o perfil dele (`cli_select_own_profile`, 0004).
-- Um select direto voltaria vazio e o portal mostraria a marca errada.
--
-- Função em vez de policy nova: abrir `profiles` do engenheiro ao cliente
-- entregaria junto telefone, CPF e CREA. Aqui saem duas colunas, as que a
-- marca precisa, e nada mais.
-- ---------------------------------------------------------------------------
create or replace function public.logo_da_empresa()
returns table (logo_path text, nome text)
language sql stable security definer set search_path = public as $$
  select p.logo_path, p.nome
  from profiles p
  where p.role = 'engenheiro'
  order by p.created_at
  limit 1;
$$;

grant execute on function public.logo_da_empresa() to authenticated;
