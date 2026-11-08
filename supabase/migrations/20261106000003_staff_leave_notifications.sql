-- Phase 4: staff leave self-service and private in-app notifications.

alter type public.leave_request_status add value if not exists 'cancelled';

alter table public.notification
  add column if not exists recipient_user_id uuid references public.app_user(id) on delete cascade,
  add column if not exists notification_kind text,
  add column if not exists title text,
  add column if not exists body text,
  add column if not exists link text,
  add column if not exists read_at timestamptz;

alter table public.notification drop constraint if exists notification_channel_check;
alter table public.notification add constraint notification_channel_check
  check (channel in ('sms','email','push','in_app'));
alter table public.notification enable row level security;
drop policy if exists notification_own_in_app_read on public.notification;
create policy notification_own_in_app_read on public.notification
  for select to authenticated
  using (channel = 'in_app' and recipient_user_id = auth.uid());
drop policy if exists notification_own_in_app_update on public.notification;
create policy notification_own_in_app_update on public.notification
  for update to authenticated
  using (channel = 'in_app' and recipient_user_id = auth.uid())
  with check (channel = 'in_app' and recipient_user_id = auth.uid());
revoke all on public.notification from public, anon, authenticated;
grant select on public.notification to authenticated;
grant update (read_at) on public.notification to authenticated;
grant all on public.notification to service_role;
create index if not exists notification_in_app_unread_idx
  on public.notification(recipient_user_id, created_at desc) where channel='in_app' and read_at is null;

drop policy if exists leave_manage on public.leave_request;
drop policy if exists leave_staff_submit on public.leave_request;
create policy leave_staff_submit on public.leave_request
  for insert to authenticated
  with check (
    staff_user_id = auth.uid() and requested_by = auth.uid() and status = 'requested'
    and (select role from public.app_user where id = auth.uid()) = 'staff'
  );
create policy leave_admin_manage on public.leave_request
  for all to authenticated
  using ((select role from public.app_user where id=auth.uid()) in ('manager','hr'))
  with check ((select role from public.app_user where id=auth.uid()) in ('manager','hr'));
revoke insert, update, delete on public.leave_request from public, anon, authenticated;
grant select on public.leave_request to authenticated;
grant all on public.leave_request to service_role;

create or replace function public.preview_my_leave_request(
  p_staff_user_id uuid, p_from_date date, p_to_date date, p_leave_type text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  staff public.app_user%rowtype;
  requested_days integer;
  overlap_found boolean;
  entitlement numeric;
  taken numeric;
  approved_upcoming numeric;
  pending numeric;
  holidays date[];
begin
  select * into staff from public.app_user where id=p_staff_user_id and status='active' and role='staff';
  if staff.id is null then raise exception 'Active staff profile not found' using errcode='42501'; end if;
  if p_from_date is null or p_to_date is null or p_to_date < p_from_date then raise exception 'End date must be on or after start date' using errcode='22023'; end if;
  if p_from_date < (pg_catalog.now() at time zone 'Africa/Kampala')::date then raise exception 'Leave requests cannot start in the past' using errcode='22023'; end if;
  if p_leave_type is null or p_leave_type not in ('annual_leave','unpaid_leave','other_approved_leave') then raise exception 'Invalid leave type' using errcode='22023'; end if;
  select coalesce(p.public_holidays,array[]::date[]) into holidays
    from public.annual_leave_policy p where p.location_id=staff.location_id and p.effective_from <= (pg_catalog.now() at time zone 'Africa/Kampala')::date order by p.effective_from desc limit 1;
  select count(*)::int into requested_days from pg_catalog.generate_series(p_from_date,p_to_date,interval '1 day') d(day)
    where public.is_staff_workday(staff.id,d.day::date) and not (d.day::date = any(coalesce(holidays,array[]::date[])));
  select exists(select 1 from public.leave_request l where l.staff_user_id=staff.id and l.status in ('requested','approved') and l.from_date <= p_to_date and l.to_date >= p_from_date) into overlap_found;
  select b.entitlement_days,b.days_taken,b.days_approved_upcoming,b.days_pending into entitlement,taken,approved_upcoming,pending from public.hr_leave_balance b where b.staff_user_id=staff.id;
  return pg_catalog.jsonb_build_object(
    'working_days',requested_days,
    'overlaps_existing',coalesce(overlap_found,false),
    'entitlement_days',entitlement,
    'days_taken',coalesce(taken,0),
    'days_approved_upcoming',coalesce(approved_upcoming,0),
    'days_pending',coalesce(pending,0),
    'days_remaining',case when entitlement is null then null else greatest(0,entitlement-coalesce(taken,0)-coalesce(approved_upcoming,0)) end,
    'exceeds_balance',p_leave_type='annual_leave' and (entitlement is null or coalesce(taken,0)+coalesce(approved_upcoming,0)+coalesce(pending,0)+requested_days>entitlement)
  );
end;
$$;

create or replace function public.request_my_leave(
  p_staff_user_id uuid, p_from_date date, p_to_date date, p_leave_type text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare preview jsonb; inserted_id uuid; staff public.app_user%rowtype;
begin
  select * into staff from public.app_user where id=p_staff_user_id and status='active' and role='staff';
  if staff.id is null then raise exception 'Active staff profile not found' using errcode='42501'; end if;
  preview := public.preview_my_leave_request(p_staff_user_id,p_from_date,p_to_date,p_leave_type);
  if coalesce((preview->>'overlaps_existing')::boolean,false) then raise exception 'These dates overlap an existing request or approved leave' using errcode='23P01'; end if;
  if coalesce((preview->>'working_days')::int,0)=0 then raise exception 'The selected dates contain no scheduled working days' using errcode='22023'; end if;
  if coalesce((preview->>'exceeds_balance')::boolean,false) then raise exception 'The request exceeds the available annual leave balance. Contact HR.' using errcode='23514'; end if;
  insert into public.leave_request(organization_id,location_id,staff_user_id,from_date,to_date,leave_type,status,requested_by)
    values(staff.organization_id,staff.location_id,staff.id,p_from_date,p_to_date,p_leave_type,'requested',staff.id) returning id into inserted_id;
  insert into public.audit_log(organization_id,location_id,actor_id,actor_role,action,entity_type,entity_id,category,reason,after)
    values(staff.organization_id,staff.location_id,staff.id,'staff','LEAVE_REQUESTED','leave_request',inserted_id,'people','Staff submitted a leave request',pg_catalog.jsonb_build_object('from_date',p_from_date,'to_date',p_to_date,'leave_type',p_leave_type,'working_days',preview->'working_days'));
  return preview || pg_catalog.jsonb_build_object('success',true,'request_id',inserted_id);
end;
$$;

create or replace function public.cancel_my_leave_request(p_staff_user_id uuid,p_leave_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare leave_row public.leave_request%rowtype; staff public.app_user%rowtype;
begin
  select * into staff from public.app_user where id=p_staff_user_id and status='active' and role='staff';
  if staff.id is null then raise exception 'Active staff profile not found' using errcode='42501'; end if;
  select * into leave_row from public.leave_request where id=p_leave_id and staff_user_id=staff.id for update;
  if leave_row.id is null then raise exception 'Leave request not found' using errcode='P0002'; end if;
  if leave_row.status <> 'requested' then raise exception 'Only pending requests can be cancelled' using errcode='22023'; end if;
  update public.leave_request set status='cancelled' where id=leave_row.id;
  insert into public.audit_log(organization_id,location_id,actor_id,actor_role,action,entity_type,entity_id,category,reason,before,after)
    values(staff.organization_id,staff.location_id,staff.id,'staff','LEAVE_REQUEST_CANCELLED','leave_request',leave_row.id,'people','Staff cancelled a pending leave request',pg_catalog.jsonb_build_object('status',leave_row.status),pg_catalog.jsonb_build_object('status','cancelled'));
  return pg_catalog.jsonb_build_object('success',true);
end;
$$;

create or replace function public.mark_my_notification_read(p_user_id uuid,p_notification_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.app_user where id=p_user_id and status='active') then
    raise exception 'Active user not found' using errcode='42501';
  end if;
  update public.notification set read_at=pg_catalog.now()
    where id=p_notification_id and channel='in_app' and recipient_user_id=p_user_id and read_at is null;
  return found;
end;
$$;

create or replace function public.notify_leave_changes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare staff public.app_user%rowtype; hr_user record; notice_title text; notice_body text;
begin
  select * into staff from public.app_user where id=new.staff_user_id;
  if tg_op='INSERT' and new.status='requested' then
    for hr_user in select id from public.app_user where location_id=new.location_id and status='active' and role='hr' loop
      insert into public.notification(channel,recipient,template,payload,status,provider,recipient_user_id,notification_kind,title,body,link)
        values('in_app',hr_user.id::text,'leave_request',pg_catalog.jsonb_build_object('request_id',new.id),'queued','internal',hr_user.id,'leave_request','New leave request','A staff member submitted a leave request.','/hr/leave');
    end loop;
  elsif tg_op='UPDATE' and old.status='requested' and new.status in ('approved','rejected') then
    notice_title := case when new.status='approved' then 'Leave request approved' else 'Leave request rejected' end;
    notice_body := case when new.status='approved' then 'Your leave request was approved.' else 'Your leave request was rejected. Please contact HR for details.' end;
    insert into public.notification(channel,recipient,template,payload,status,provider,recipient_user_id,notification_kind,title,body,link)
      values('in_app',new.staff_user_id::text,'leave_decision',pg_catalog.jsonb_build_object('request_id',new.id,'status',new.status),'queued','internal',new.staff_user_id,'leave_decision',notice_title,notice_body,'/staff/leave');
  end if;
  return new;
end;
$$;
drop trigger if exists trg_notify_leave_changes on public.leave_request;
create trigger trg_notify_leave_changes after insert or update of status on public.leave_request
  for each row execute function public.notify_leave_changes();

revoke all on function public.preview_my_leave_request(uuid,date,date,text) from public,anon,authenticated;
revoke all on function public.request_my_leave(uuid,date,date,text) from public,anon,authenticated;
revoke all on function public.cancel_my_leave_request(uuid,uuid) from public,anon,authenticated;
revoke all on function public.mark_my_notification_read(uuid,uuid) from public,anon,authenticated;
grant execute on function public.preview_my_leave_request(uuid,date,date,text) to service_role;
grant execute on function public.request_my_leave(uuid,date,date,text) to service_role;
grant execute on function public.cancel_my_leave_request(uuid,uuid) to service_role;
grant execute on function public.mark_my_notification_read(uuid,uuid) to service_role;

do $$ begin
  if exists(select 1 from pg_catalog.pg_publication where pubname='supabase_realtime')
    and not exists(select 1 from pg_catalog.pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notification') then
    alter publication supabase_realtime add table public.notification;
  end if;
end $$;

alter table public.notification replica identity full;
