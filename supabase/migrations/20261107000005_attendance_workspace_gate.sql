-- Authoritative attendance predicate used by the request gate.
create or replace function public.is_user_clocked_in(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when u.role = 'owner' then true
      else exists (
        select 1
        from public.attendance a
        where a.staff_user_id = u.id
          and a.business_date = (now() at time zone 'Africa/Kampala')::date
          and a.clock_in is not null
          and a.clock_out is null
          and not a.on_break
      )
    end
    from public.app_user u
    where u.id = p_user_id and u.status = 'active'
  ), false);
$$;

revoke all on function public.is_user_clocked_in(uuid) from public, anon, authenticated;
grant execute on function public.is_user_clocked_in(uuid) to service_role;

notify pgrst, 'reload schema';
