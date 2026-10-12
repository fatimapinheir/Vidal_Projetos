-- Cliente como pessoa física ou jurídica, com documento.
--
-- O documento vai alimentar requerimentos de prefeitura, então precisa ser
-- único: dois cadastros com o mesmo CPF seriam a mesma pessoa duas vezes, e
-- não haveria como saber qual é o bom na hora de gerar o documento.

create type tipo_pessoa as enum ('pf', 'pj');

alter table profiles
  add column tipo_pessoa tipo_pessoa,
  add column cpf_cnpj text;

-- Só dígitos, e a quantidade tem que bater com o tipo. O dígito verificador é
-- conferido na aplicação; aqui fica a garantia de formato, que é o que impede
-- um CNPJ entrar no lugar de um CPF por engano de tela.
alter table profiles
  add constraint profiles_documento_formato check (
    cpf_cnpj is null
    or (tipo_pessoa = 'pf' and cpf_cnpj ~ '^\d{11}$')
    or (tipo_pessoa = 'pj' and cpf_cnpj ~ '^\d{14}$')
  );

-- Parcial: vários clientes sem documento convivem; dois com o mesmo, não.
create unique index idx_profiles_cpf_cnpj on profiles(cpf_cnpj) where cpf_cnpj is not null;

-- O gatilho já copiava nome/role/email do metadata do Auth; passa a copiar
-- também telefone e os dois campos novos, mantendo um caminho único de criação.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, role, email, telefone, tipo_pessoa, cpf_cnpj)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', new.email),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'cliente'),
    new.email,
    nullif(new.raw_user_meta_data->>'telefone', ''),
    (nullif(new.raw_user_meta_data->>'tipo_pessoa', ''))::tipo_pessoa,
    nullif(new.raw_user_meta_data->>'cpf_cnpj', '')
  );
  return new;
end;
$$;
