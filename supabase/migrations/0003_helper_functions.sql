-- Funções auxiliares usadas nas políticas de RLS (security definer evita recursão)
create or replace function public.is_engenheiro()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'engenheiro');
$$;

create or replace function public.cliente_tem_acesso_obra(p_obra_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from obra_clientes where obra_id = p_obra_id and cliente_id = auth.uid()
  );
$$;
