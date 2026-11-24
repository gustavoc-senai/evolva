-- Remove planos comerciais e bloqueios por assinatura/limite de alunos.
begin;
create or replace function public.evolva_can_write(p_workspace uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select true; $$;

create or replace function public.evolva_write_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
declare w uuid;
begin
  if tg_table_name='evolva_students' and tg_op='UPDATE' then
    if current_setting('evolva.revoke',true)='on' and new.account_id is null
       and (to_jsonb(new)-'account_id')=(to_jsonb(old)-'account_id') then return new; end if;
  end if;
  if tg_table_name='evolva_charges' and tg_op='UPDATE' then
    if (to_jsonb(new)-'status')=(to_jsonb(old)-'status') then return new; end if;
  end if;
  if tg_table_name='evolva_events' and tg_op='UPDATE' then
    if new.status='CONFIRMED' and (to_jsonb(new)-'status')=(to_jsonb(old)-'status') then return new; end if;
  end if;
  w:=new.workspace_id;
  if w is not null then perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(w::text,1)); end if;
  return new;
end $$;

drop trigger if exists evolva_trial on public.evolva_workspaces;
drop function if exists public.evolva_trial();
drop function if exists public.evolva_request_plan(uuid,text);
drop function if exists public.evolva_platform_state();
drop function if exists public.evolva_admin_subscription(uuid,text,text,timestamptz);
drop function if exists public.evolva_is_admin();
drop table if exists public.evolva_plan_requests;
drop table if exists public.evolva_subscriptions;
drop table if exists public.evolva_plans;
drop table if exists public.evolva_platform_admins;
commit;
