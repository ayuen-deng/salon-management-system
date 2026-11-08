-- Migration: Receipts & Gapless Sequence
-- Date: 2026-10-11

create sequence if not exists receipt_no_seq start with 1001;

create table if not exists receipt (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references location(id) on delete cascade,
  visit_id uuid not null references visit(id) on delete cascade,
  receipt_no text not null unique,
  issued_at timestamptz not null default now(),
  issued_by uuid not null references app_user(id),
  snapshot jsonb not null default '{}'::jsonb,
  print_count int not null default 1,
  last_printed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_receipt_visit on receipt(visit_id);

alter table receipt enable row level security;

-- Receipts viewable by owner, manager, receptionist
create policy receipt_select on receipt
  for select using (
    (select role from app_user where id = auth.uid()) in ('owner', 'manager', 'receptionist')
  );

-- Receipts created and updated by receptionist and manager
create policy receipt_manage on receipt
  for all using (
    (select role from app_user where id = auth.uid()) in ('manager', 'receptionist')
  );
