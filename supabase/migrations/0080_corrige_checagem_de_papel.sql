-- `definir_obra_padrao` quebrava para quem tem dois perfis — justamente a
-- única pessoa que a função existe para servir.
--
-- A linha era:
--
--   'engenheiro' = any (select papeis from profiles where id = v_id)
--
-- Lido como "está entre os papéis dele", e o Postgres lê outra coisa:
-- `= ANY (subconsulta)` compara contra o CONJUNTO DE LINHAS devolvido, e cada
-- linha aqui é um `user_role[]`. Ele tenta então comparar o texto 'engenheiro'
-- com um array e aborta com `malformed array literal: "engenheiro"`.
--
-- `= ANY (array)` e `= ANY (subconsulta)` são duas construções diferentes com a
-- mesma aparência, e a diferença só aparece quando a subconsulta devolve uma
-- coluna que já é array. A forma sem ambiguidade é o `exists` com o `any`
-- aplicado à coluna dentro dele.
create or replace function public.definir_obra_padrao(p_obra_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := auth.uid();
begin
  if v_id is null then
    raise exception 'Não há sessão.';
  end if;

  if p_obra_id is not null
     and not exists (select 1 from obras where id = p_obra_id)
  then
    raise exception 'Obra não encontrada.';
  end if;

  /*
   * Quem pode escolher a obra: engenheiro (vê todas) ou cliente vinculado a
   * ela. A checagem usa os PAPÉIS, não o perfil ativo: ele define a obra
   * padrão do perfil de engenheiro estando no perfil de cliente, e exigir que
   * ele troque antes para poder escolher seria um vai-e-volta sem motivo.
   */
  if p_obra_id is not null
     and not (
       exists (
         select 1 from profiles
          where id = v_id and 'engenheiro' = any (papeis)
       )
       or cliente_tem_acesso_obra(p_obra_id)
     )
  then
    raise exception 'Acesso negado';
  end if;

  update profiles set obra_padrao_id = p_obra_id where id = v_id;
end;
$$;

comment on function public.definir_obra_padrao(uuid) is
  'Define (ou limpa, com null) a obra em que o perfil de engenheiro abre. Confere acesso pelos PAPÉIS, para poder ser chamada dos dois perfis.';
