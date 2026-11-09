-- Resolve the authenticated caller's own role without recursively applying
-- app_user's row policy to the same lookup. This helper exposes no other user's
-- profile data and preserves the existing role-based policy boundaries.
create or replace function public.current_app_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select u.role
  from public.app_user as u
  where u.id = auth.uid()
  limit 1;
$$;

revoke all on function public.current_app_user_role() from public, anon;
grant execute on function public.current_app_user_role() to authenticated, service_role;

drop policy if exists app_user_select on public.app_user;
create policy app_user_select on public.app_user
  for select using (
    public.current_app_user_role() in ('owner', 'manager', 'hr')
    or id = auth.uid()
  );

drop policy if exists app_user_hr_manage on public.app_user;
create policy app_user_hr_manage on public.app_user
  for all using (
    public.current_app_user_role() = 'hr'
  );
