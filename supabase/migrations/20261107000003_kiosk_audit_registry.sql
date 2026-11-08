-- Register all receptionist kiosk handoff audit actions so the canonical
-- audit trigger accepts claim, release, cancellation and payment confirmation.
insert into public.audit_action_category (action, category) values
  ('KIOSK_ORDER_CREATED', 'operations'),
  ('KIOSK_ORDER_CLAIMED', 'operations'),
  ('KIOSK_ORDER_RELEASED', 'operations'),
  ('KIOSK_ORDER_CANCELLED', 'operations'),
  ('KIOSK_ORDER_EXPIRED', 'operations'),
  ('KIOSK_ORDER_PAYMENT_CONFIRMED', 'money')
on conflict (action) do update set category = excluded.category;
