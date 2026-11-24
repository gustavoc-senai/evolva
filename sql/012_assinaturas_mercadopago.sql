-- Execute após a instalação base para habilitar checkout recorrente Mercado Pago.
alter table public.evolva_subscriptions
  add column if not exists mercadopago_preapproval_id text,
  add column if not exists mercadopago_plan_code text,
  add column if not exists mercadopago_status text;

create unique index if not exists evolva_subscription_mp_preapproval_unique
  on public.evolva_subscriptions (mercadopago_preapproval_id)
  where mercadopago_preapproval_id is not null;
