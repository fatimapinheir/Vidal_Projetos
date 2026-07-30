-- Guarda o email no profile para o engenheiro conseguir localizar/vincular clientes
-- existentes ao criar uma obra, sem precisar de acesso a auth.users.
alter table profiles add column email text;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, role, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', new.email),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'cliente'),
    new.email
  );
  return new;
end;
$$;
