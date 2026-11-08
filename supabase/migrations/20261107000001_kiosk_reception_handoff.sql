-- Phase 2: receptionist claims kiosk drafts and atomically converts them to paid queue visits.
begin;

alter table public.visit
  add column if not exists claimed_by uuid references public.app_user(id),
  add column if not exists claimed_at timestamptz;

create index if not exists visit_kiosk_claim_idx
  on public.visit (location_id, created_at)
  where created_via = 'desk_tablet' and status = 'draft';

create or replace function public.list_reception_kiosk_orders(p_actor_id uuid)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare actor public.app_user%rowtype; result jsonb;
begin
  select * into actor from public.app_user where id = p_actor_id and status = 'active';
  if not found or actor.role not in ('manager','receptionist') then
    raise exception 'Only reception or management can view kiosk orders' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', v.id, 'order_code', v.order_code, 'first_name', v.draft_first_name,
    'phone', v.draft_phone_e164, 'total_ugx', v.total_final_ugx,
    'created_at', v.created_at, 'claimed_by', v.claimed_by,
    'claimed_at', v.claimed_at, 'claimant_name', u.display_name,
    'lines', coalesce(lines.items, '[]'::jsonb)
  ) order by v.created_at asc), '[]'::jsonb) into result
  from public.visit v
  left join public.app_user u on u.id = v.claimed_by
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'variant_id', vs.service_variant_id, 'service_id', s.id,
      'service_name', s.name, 'variant_name', sv.name,
      'original_price_ugx', vs.list_price_ugx,
      'list_price_ugx', sv.list_price_ugx, 'min_price_ugx', sv.min_price_ugx,
      'max_price_ugx', sv.max_price_ugx, 'expected_minutes', sv.expected_minutes,
      'preferred_stylist_id', vs.staff_user_id
    ) order by vs.sequence_no) items
    from public.visit_service vs
    join public.service_variant sv on sv.id = vs.service_variant_id
    join public.service s on s.id = sv.service_id
    where vs.visit_id = v.id
  ) lines on true
  where v.location_id = actor.location_id and v.created_via = 'desk_tablet' and v.status = 'draft';
  return result;
end;
$$;

create or replace function public.claim_reception_kiosk_order(p_order_id uuid, p_actor_id uuid)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare actor public.app_user%rowtype; target public.visit%rowtype;
begin
  select * into actor from public.app_user where id = p_actor_id and status = 'active';
  if not found or actor.role not in ('manager','receptionist') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into target from public.visit where id = p_order_id and location_id = actor.location_id
    and created_via = 'desk_tablet' and status = 'draft' for update;
  if not found then return jsonb_build_object('success',false,'code','NOT_PENDING','message','This order is no longer waiting.'); end if;
  if target.claimed_by is not null and target.claimed_by <> p_actor_id
     and target.claimed_at > now() - interval '2 minutes' then
    return jsonb_build_object('success',false,'code','CLAIMED','message','Being handled by ' || coalesce((select display_name from public.app_user where id=target.claimed_by),'another receptionist'));
  end if;
  update public.visit set claimed_by=p_actor_id, claimed_at=now(), updated_at=now() where id=target.id;
  insert into public.audit_log(actor_id,actor_role,action,entity_type,entity_id,before,after,reason,business_day_id,category)
  values(p_actor_id,actor.role::text,'KIOSK_ORDER_CLAIMED','visit',target.id::text,
    jsonb_build_object('claimed_by',target.claimed_by),jsonb_build_object('claimed_by',p_actor_id),
    'Reception opened kiosk order '||target.order_code,target.business_day_id,'operations');
  return jsonb_build_object('success',true,'order',public.list_reception_kiosk_orders(p_actor_id));
end;
$$;

create or replace function public.touch_reception_kiosk_claim(p_order_id uuid, p_actor_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.app_user%rowtype; affected integer;
begin
  select * into actor from public.app_user where id=p_actor_id and status='active' and role in ('manager','receptionist');
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  update public.visit set claimed_at=now(),updated_at=now()
   where id=p_order_id and location_id=actor.location_id and created_via='desk_tablet' and status='draft' and claimed_by=p_actor_id;
  get diagnostics affected=row_count; return affected=1;
end; $$;

create or replace function public.release_reception_kiosk_order(p_order_id uuid, p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.app_user%rowtype; target public.visit%rowtype;
begin
  select * into actor from public.app_user where id=p_actor_id and status='active' and role in ('manager','receptionist');
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  update public.visit set claimed_by=null,claimed_at=null,updated_at=now()
   where id=p_order_id and location_id=actor.location_id and created_via='desk_tablet' and status='draft' and claimed_by=p_actor_id
   returning * into target;
  if not found then return jsonb_build_object('success',false,'message','This order is no longer claimed by you.'); end if;
  insert into public.audit_log(actor_id,actor_role,action,entity_type,entity_id,after,reason,business_day_id,category)
  values(p_actor_id,actor.role::text,'KIOSK_ORDER_RELEASED','visit',target.id::text,jsonb_build_object('order_code',target.order_code),'Reception released kiosk order '||target.order_code,target.business_day_id,'operations');
  return jsonb_build_object('success',true);
end; $$;

create or replace function public.cancel_reception_kiosk_order(p_order_id uuid,p_actor_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor public.app_user%rowtype; target public.visit%rowtype;
begin
  select * into actor from public.app_user where id=p_actor_id and status='active' and role in ('manager','receptionist');
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  if p_reason not in ('Customer left','Changed mind','Duplicate order') then raise exception 'Invalid cancellation reason'; end if;
  update public.visit set status='cancelled',claimed_by=null,claimed_at=null,updated_at=now()
   where id=p_order_id and location_id=actor.location_id and created_via='desk_tablet' and status='draft'
    and (claimed_by is null or claimed_by=p_actor_id or claimed_at < now()-interval '2 minutes') returning * into target;
  if not found then return jsonb_build_object('success',false,'message','This order is being handled by another receptionist or is no longer pending.'); end if;
  insert into public.activity_event(location_id,message,actor_name,entity_link)
  values(target.location_id,'Kiosk order '||target.order_code||' cancelled unpaid: '||p_reason,actor.display_name,'/reception/visits');
  insert into public.audit_log(actor_id,actor_role,action,entity_type,entity_id,reason,business_day_id,category)
  values(p_actor_id,actor.role::text,'KIOSK_ORDER_CANCELLED','visit',target.id::text,p_reason,target.business_day_id,'operations');
  return jsonb_build_object('success',true);
end; $$;

create or replace function public.confirm_reception_kiosk_order(
  p_order_id uuid,p_actor_id uuid,p_customer_first_name text,p_phone text,
  p_lines jsonb,p_discount_ugx bigint,p_discount_reason text,
  p_method text,p_provider_reference text,p_idempotency_key text,p_number_read_back boolean
)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare
  actor public.app_user%rowtype; target public.visit%rowtype; day public.business_day%rowtype;
  cust public.customer%rowtype; line jsonb; variant public.service_variant%rowtype; svc public.service%rowtype;
  ticket text; total bigint:=0; total_list bigint:=0; discount bigint:=coalesce(p_discount_ugx,0); seq integer:=0;
  first_line boolean; receipt_id uuid:=gen_random_uuid(); receipt_number text; settings jsonb; snap jsonb;
  new_phone text; names integer; prior_ticket text; prior_receipt uuid; prior_receipt_no text; prior_amount bigint;
begin
  select * into actor from public.app_user where id=p_actor_id and status='active' and role in ('manager','receptionist');
  if not found then raise exception 'forbidden' using errcode='42501'; end if;
  if p_idempotency_key is null or length(p_idempotency_key)<16 or length(p_idempotency_key)>100 then
    raise exception 'Invalid payment request';
  end if;
  -- Serialize retries for this order so a simultaneous retry returns the committed
  -- receipt instead of reporting that the draft is no longer pending.
  perform pg_advisory_xact_lock(hashtextextended('kiosk_reception_payment:'||p_order_id::text,0));
  select v.ticket_code,r.id,r.receipt_no,p.amount_ugx into prior_ticket,prior_receipt,prior_receipt_no,prior_amount
    from public.payment p join public.visit v on v.id=p.visit_id left join public.receipt r on r.visit_id=v.id
   where p.idempotency_key=p_idempotency_key and p.visit_id=p_order_id limit 1;
  if found then return jsonb_build_object('success',true,'visit_id',p_order_id,'ticket_code',prior_ticket,
    'receipt_id',prior_receipt,'receipt_number',prior_receipt_no,'total_final_ugx',prior_amount); end if;
  select * into target from public.visit where id=p_order_id and location_id=actor.location_id
   and created_via='desk_tablet' and status='draft' for update;
  if not found then return jsonb_build_object('success',false,'code','NOT_PENDING','message','This order is no longer waiting.'); end if;
  if target.claimed_by is distinct from p_actor_id or target.claimed_at < now()-interval '2 minutes' then
    return jsonb_build_object('success',false,'code','CLAIM_REQUIRED','message','Reopen this order to claim it before confirming payment.'); end if;
  if p_number_read_back is not true then return jsonb_build_object('success',false,'code','READBACK_REQUIRED','message','Confirm that you read the phone number back to the customer.'); end if;
  if p_method not in ('cash','mobile_money') or (p_method='mobile_money' and nullif(btrim(p_provider_reference),'') is null) then
    return jsonb_build_object('success',false,'code','PAYMENT_DETAILS','message','Choose a payment method and enter the Mobile Money reference.'); end if;
  if discount<0 then return jsonb_build_object('success',false,'code','INVALID_DISCOUNT','message','Discount cannot be negative.'); end if;
  if discount>10000 and not exists (
    select 1 from public.approval_request ar where ar.kind='discount' and ar.status='approved'
      and ar.payload->>'visit_id'=target.id::text
      and coalesce((ar.payload->>'decided_amount_ugx')::bigint,0)>=discount
  ) then return jsonb_build_object('success',false,'code','DISCOUNT_APPROVAL_REQUIRED','message','A manager must approve this discount before payment.'); end if;
  if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then return jsonb_build_object('success',false,'code','LINES_REQUIRED','message','Add at least one service before payment.'); end if;
  new_phone:=public.normalize_ug_phone(coalesce(p_phone,''));
  if new_phone !~ '^\+2567[0-9]{8}$' then return jsonb_build_object('success',false,'code','INVALID_PHONE','message','Enter a valid Uganda mobile number.'); end if;
  if nullif(btrim(p_customer_first_name),'') is null then return jsonb_build_object('success',false,'code','INVALID_NAME','message','Enter the customer first name.'); end if;
  select * into day from public.business_day where id=target.business_day_id and status='open' for update;
  if not found then return jsonb_build_object('success',false,'code','DAY_CLOSED','message','The business day is closed.'); end if;
  select count(*) into names from public.customer where location_id=actor.location_id and phone_e164=new_phone and merged_into is null;
  if names>1 then return jsonb_build_object('success',false,'code','CUSTOMER_AMBIGUOUS','message','More than one customer profile uses this phone. Ask a manager to resolve it.'); end if;
  select * into cust from public.customer where location_id=actor.location_id and phone_e164=new_phone and merged_into is null limit 1;
  for line in select value from jsonb_array_elements(p_lines) loop
    select sv.* into variant from public.service_variant sv join public.service s on s.id=sv.service_id
     where sv.id=(line->>'variant_id')::uuid and sv.active and s.active and s.location_id=actor.location_id;
    if not found then return jsonb_build_object('success',false,'code','CATALOGUE_CHANGED','message','A selected service is no longer available. Review the services and try again.'); end if;
    if coalesce((line->>'price_ugx')::bigint,variant.list_price_ugx) < variant.min_price_ugx
      or coalesce((line->>'price_ugx')::bigint,variant.list_price_ugx) > variant.max_price_ugx then
      return jsonb_build_object('success',false,'code','PRICE_OUT_OF_RANGE','message','A negotiated service price is outside the approved range.');
    end if;
    if coalesce((line->>'price_ugx')::bigint,variant.list_price_ugx) <> variant.list_price_ugx
      and nullif(btrim(line->>'custom_price_reason'),'') is null then
      return jsonb_build_object('success',false,'code','PRICE_REASON_REQUIRED','message','Add a reason for each negotiated service price.');
    end if;
    if nullif(line->>'preferred_stylist_id','') is not null and not exists (
      select 1 from public.attendance a join public.staff_skill sk on sk.staff_user_id=a.staff_user_id
       where a.staff_user_id=(line->>'preferred_stylist_id')::uuid and sk.service_id=variant.service_id
        and a.business_date=day.business_date and a.clock_in is not null and a.clock_out is null and not a.on_break
    ) then return jsonb_build_object('success',false,'code','NO_ELIGIBLE_STAFF','message','The selected stylist is not clocked in or is not eligible for this service.'); end if;
    if nullif(line->>'preferred_stylist_id','') is null and not exists (
      select 1 from public.attendance a join public.app_user u on u.id=a.staff_user_id
       where a.business_date=day.business_date and a.location_id=actor.location_id and a.clock_in is not null and a.clock_out is null and not a.on_break
        and u.role='staff' and u.status='active'
        and (not exists (select 1 from public.staff_skill where staff_user_id=a.staff_user_id) or exists (select 1 from public.staff_skill where staff_user_id=a.staff_user_id and service_id=variant.service_id))
    ) then return jsonb_build_object('success',false,'code','NO_ELIGIBLE_STAFF','message','No clocked-in stylist is eligible for one of these services.'); end if;
    total_list:=total_list+variant.list_price_ugx;
    total:=total+coalesce((line->>'price_ugx')::bigint,variant.list_price_ugx);
  end loop;
  if discount>=total then return jsonb_build_object('success',false,'code','INVALID_DISCOUNT','message','Discount must be less than the service total.'); end if;
  if cust.id is null then
    insert into public.customer(organization_id,location_id,phone_e164,first_name,created_by)
    values(actor.organization_id,actor.location_id,new_phone,initcap(regexp_replace(btrim(p_customer_first_name),'\s+',' ','g')),p_actor_id) returning * into cust;
  end if;
  delete from public.visit_service where visit_id=target.id;
  for line in select value from jsonb_array_elements(p_lines) loop
    select sv.* into variant from public.service_variant sv join public.service s on s.id=sv.service_id
      where sv.id=(line->>'variant_id')::uuid and sv.active and s.active and s.location_id=actor.location_id;
    select * into svc from public.service where id=variant.service_id;
    seq:=seq+1; first_line:=seq=1 or coalesce((line->>'concurrent_with_previous')::boolean,false);
    insert into public.visit_service(visit_id,service_variant_id,staff_user_id,preferred_staff_id,assignment_mode,sequence_no,status,list_price_ugx,discount_ugx,final_price_ugx,price_source,ready_at)
    values(target.id,variant.id,nullif(line->>'preferred_stylist_id','')::uuid,nullif(line->>'preferred_stylist_id','')::uuid,
      case when nullif(line->>'preferred_stylist_id','') is null then 'any'::public.assignment_mode else 'strict'::public.assignment_mode end,
      seq,case when first_line then 'ready'::public.service_line_status else 'blocked'::public.service_line_status end,
      variant.list_price_ugx,variant.list_price_ugx-coalesce((line->>'price_ugx')::bigint,variant.list_price_ugx),
      coalesce((line->>'price_ugx')::bigint,variant.list_price_ugx),
      case when coalesce((line->>'price_ugx')::bigint,variant.list_price_ugx)<>variant.list_price_ugx then 'custom'::public.price_source_type else 'catalogue'::public.price_source_type end,
      case when first_line then now() else null end);
  end loop;
  ticket:=public.next_ticket_code(day.id,'A');
  update public.visit set customer_id=cust.id,status='queued',ticket_code=ticket,queued_at=now(),claimed_by=null,claimed_at=null,
   total_list_ugx=total_list,total_discount_ugx=(total_list-total)+discount,total_final_ugx=total-discount,updated_at=now(),version=version+1
   where id=target.id;
  if discount>0 then
    insert into public.discount(visit_id,kind,amount_ugx,reason_code,applied_by)
    values(target.id,'fixed',discount,coalesce(nullif(btrim(p_discount_reason),''),'Reception discount'),p_actor_id);
  end if;
  insert into public.payment(organization_id,location_id,visit_id,business_day_id,method,provider,amount_ugx,status,confirmation_level,provider_reference,idempotency_key,recorded_by)
  values(actor.organization_id,actor.location_id,target.id,day.id,case when p_method='mobile_money' then 'mobile_money'::public.payment_method else 'cash'::public.payment_method end,
   case when p_method='mobile_money' then 'mtn_airtel_manual' else 'manual' end,total-discount,'confirmed',
   case when p_method='cash' then 'confirmed_via_provider'::public.confirmation_level else 'attested'::public.confirmation_level end,
   nullif(btrim(p_provider_reference),''),p_idempotency_key,p_actor_id);
  select coalesce(jsonb_object_agg(key,case when jsonb_typeof(value)='string' then to_jsonb(value#>>'{}') else value end),'{}'::jsonb) into settings
   from public.app_setting where location_id=actor.location_id and key in ('salon_name','location_name','receipt_address','receipt_phone','receipt_footer','receipt_fiscal_disclaimer_enabled');
  receipt_number:='REC-'||lpad(nextval('public.receipt_no_seq')::text,8,'0');
  select jsonb_build_object('id',receipt_id,'receipt_no',receipt_number,'visit_id',target.id,'ticket_code',ticket,
    'customer_first_name',split_part(cust.first_name,' ',1),'issued_at',now(),'salon_name',coalesce(settings->>'salon_name','Mzuri Unisex Salon'),
    'location_name',coalesce(settings->>'location_name','Mbarara'),'receipt_address',coalesce(settings->>'receipt_address',''),
    'receipt_phone',coalesce(settings->>'receipt_phone',''),'receipt_footer',coalesce(settings->>'receipt_footer',''),
    'fiscal_disclaimer_enabled',coalesce((settings->>'receipt_fiscal_disclaimer_enabled')::boolean,true),
    'lines',(select jsonb_agg(jsonb_build_object('service_name',s.name,'variant_name',sv.name,'final_price_ugx',vs.final_price_ugx) order by vs.sequence_no)
       from public.visit_service vs join public.service_variant sv on sv.id=vs.service_variant_id join public.service s on s.id=sv.service_id where vs.visit_id=target.id),
    'payments',jsonb_build_array(jsonb_build_object('method',case when p_method='mobile_money' then 'momo' else 'cash' end,'amount_ugx',total-discount,'provider_reference',nullif(btrim(p_provider_reference),''))),
    'subtotal_ugx',total_list,'total_discount_ugx',(total_list-total)+discount,'total_final_ugx',total-discount,
    'payment_method',case when p_method='mobile_money' then 'momo' else 'cash' end,'payment_status','confirmed','provider_reference',nullif(btrim(p_provider_reference),''),'print_count',1,'is_duplicate',false) into snap;
  insert into public.receipt(id,location_id,visit_id,receipt_no,issued_at,issued_by,snapshot)
   values(receipt_id,actor.location_id,target.id,receipt_number,now(),p_actor_id,snap);
  insert into public.activity_event(location_id,message,actor_name,entity_link)
   values(actor.location_id,'Kiosk order '||target.order_code||' paid and queued as '||ticket,actor.display_name,'/reception/visits');
  insert into public.audit_log(actor_id,actor_role,action,entity_type,entity_id,after,reason,business_day_id,category)
   values(p_actor_id,actor.role::text,'KIOSK_ORDER_PAYMENT_CONFIRMED','visit',target.id::text,
    jsonb_build_object('order_code',target.order_code,'ticket_code',ticket,'amount_ugx',total-discount,'receipt_no',receipt_number,
      'custom_price_reasons',(select coalesce(jsonb_agg(jsonb_build_object('variant_id',item->>'variant_id','price_ugx',item->>'price_ugx','reason',item->>'custom_price_reason')),'[]'::jsonb) from jsonb_array_elements(p_lines) as x(item) where nullif(item->>'custom_price_reason','') is not null)),
    'Kiosk order paid at reception',day.id,'money');
  return jsonb_build_object('success',true,'visit_id',target.id,'ticket_code',ticket,'receipt_id',receipt_id,'receipt_number',receipt_number,
    'total_list_ugx',total,'total_discount_ugx',discount,'total_final_ugx',total-discount);
end; $$;

revoke all on function public.list_reception_kiosk_orders(uuid) from public,anon,authenticated;
revoke all on function public.claim_reception_kiosk_order(uuid,uuid) from public,anon,authenticated;
revoke all on function public.touch_reception_kiosk_claim(uuid,uuid) from public,anon,authenticated;
revoke all on function public.release_reception_kiosk_order(uuid,uuid) from public,anon,authenticated;
revoke all on function public.cancel_reception_kiosk_order(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.confirm_reception_kiosk_order(uuid,uuid,text,text,jsonb,bigint,text,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.list_reception_kiosk_orders(uuid) to service_role;
grant execute on function public.claim_reception_kiosk_order(uuid,uuid) to service_role;
grant execute on function public.touch_reception_kiosk_claim(uuid,uuid) to service_role;
grant execute on function public.release_reception_kiosk_order(uuid,uuid) to service_role;
grant execute on function public.cancel_reception_kiosk_order(uuid,uuid,text) to service_role;
grant execute on function public.confirm_reception_kiosk_order(uuid,uuid,text,text,jsonb,bigint,text,text,text,text,boolean) to service_role;

-- Pending unpaid kiosk requests are recorded as expired during manager day close.
create or replace function public.confirm_close_day(p_business_day_id uuid, p_cash_counted bigint)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_user public.app_user%rowtype; v_day public.business_day%rowtype; v_open_visits integer; v_snapshot jsonb; v_expired jsonb;
begin
  select * into v_user from public.app_user where id=auth.uid();
  if not found or v_user.role<>'manager' then return jsonb_build_object('error','forbidden','message','Only manager can confirm closing of the business day.'); end if;
  select * into v_day from public.business_day where id=p_business_day_id and location_id=v_user.location_id for update;
  if not found or v_day.status not in ('open','closing') then return jsonb_build_object('error','conflict','message','Day is not in closeable state.'); end if;
  select count(*) into v_open_visits from public.visit where business_day_id=p_business_day_id and status in ('queued','in_service','ready_for_checkout');
  if v_open_visits>0 then return jsonb_build_object('error','conflict','message','Cannot close with open visits remaining. Finish or abandon visits first.'); end if;
  with expired as (
    update public.visit set status='expired',claimed_by=null,claimed_at=null,updated_at=now()
     where business_day_id=p_business_day_id and created_via='desk_tablet' and status='draft'
     returning id,location_id,order_code,draft_first_name
  )
  select coalesce(jsonb_agg(jsonb_build_object('order_code',order_code,'first_name',draft_first_name)),'[]'::jsonb) into v_expired from expired;
  insert into public.activity_event(location_id,message,actor_name,entity_link)
  select v_day.location_id,'Unpaid kiosk order '||(item->>'order_code')||' expired at day close',v_user.display_name,'/manager/visits'
   from jsonb_array_elements(v_expired) as x(item);
  select jsonb_build_object('business_date',v_day.business_date,'total_visits',count(distinct v.id),
    'completed_visits',count(distinct case when v.status in ('closed','paid') then v.id end),
    'abandoned_visits',count(distinct case when v.status in ('abandoned','expired','cancelled') then v.id end),
    'total_revenue_ugx',coalesce(sum(p.amount_ugx),0),'cash_counted_ugx',p_cash_counted,
    'kiosk_orders_expired',jsonb_array_length(v_expired)) into v_snapshot
   from public.visit v left join public.payment p on p.visit_id=v.id where v.business_day_id=p_business_day_id;
  update public.business_day set status='closed',closed_at=now(),closed_by=v_user.id,cash_counted=p_cash_counted where id=p_business_day_id;
  insert into public.business_day_snapshot(business_day_id,data) values(p_business_day_id,v_snapshot);
  perform public.log_audit_event(v_user.id,v_user.role::text,'CLOSE_DAY','business_day',p_business_day_id::text,to_jsonb(v_day),v_snapshot,'Day confirmed closed',p_business_day_id,'operations');
  return jsonb_build_object('success',true,'snapshot',v_snapshot);
end; $$;

revoke all on function public.confirm_close_day(uuid,bigint) from public,anon;
grant execute on function public.confirm_close_day(uuid,bigint) to authenticated,service_role;

commit;
