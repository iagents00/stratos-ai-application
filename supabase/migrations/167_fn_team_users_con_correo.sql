-- La pantalla de Usuarios listaba a la gente SIN su correo, porque `profiles` no
-- lo guarda (vive en `auth.users`). Consecuencias: no se podía ver con qué correo
-- entra cada uno, y el botón de "mandarle el correo para cambiar la contraseña"
-- no tenía a dónde mandarlo.
--
-- Esta función lo trae, acotado a la organización de quien pregunta y solo para
-- los roles de mando. Un admin de NSG ve los correos de NSG y de nadie más.

create or replace function public.fn_team_users(p_profile_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_org uuid; v_rol text; v_out jsonb;
begin
  select organization_id, role into v_org, v_rol from profiles where id = p_profile_id;
  if v_org is null then return '[]'::jsonb; end if;
  if v_rol not in ('super_admin','admin','director','ceo') then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(x order by x->>'created_at'), '[]'::jsonb) into v_out
  from (
    select jsonb_build_object(
      'id', p.id, 'name', p.name, 'role', p.role, 'phone', p.phone,
      'active', coalesce(p.active, true),
      'created_at', p.created_at,
      'organization_id', p.organization_id,
      'email', u.email
    ) x
    from profiles p
    left join auth.users u on u.id = p.id
   where p.organization_id = v_org
  ) s;
  return v_out;
end $$;

grant execute on function public.fn_team_users(uuid) to anon, authenticated;;
