begin;
alter table public.evolva_workspaces add column if not exists phone text;
alter table public.evolva_workspaces add column if not exists bio text;
alter table public.evolva_workspaces add column if not exists credential text;
alter table public.evolva_students add column if not exists birth_date date;
create table if not exists public.evolva_plans(code text primary key,name text not null,max_students integer not null check(max_students between 1 and 10000));
insert into public.evolva_plans values('START','Essencial',10),('PRO','Profissional',50),('STUDIO','Studio',200) on conflict(code) do nothing;
create table if not exists public.evolva_subscriptions(workspace_id uuid primary key references public.evolva_workspaces(id),plan_code text not null references public.evolva_plans(code),status text not null check(status in ('TRIAL','ACTIVE','SUSPENDED')),valid_until timestamptz not null,updated_at timestamptz not null default now());
create table if not exists public.evolva_platform_admins(account_id uuid primary key references auth.users(id));
create table if not exists public.evolva_plan_requests(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.evolva_workspaces(id),plan_code text not null references public.evolva_plans(code),status text not null default 'PENDING' check(status in ('PENDING','APPROVED','REJECTED')),created_at timestamptz not null default now(),resolved_at timestamptz);
create unique index if not exists evolva_one_plan_request on public.evolva_plan_requests(workspace_id) where status='PENDING';
create table if not exists public.evolva_assessments(id uuid primary key default gen_random_uuid(),workspace_id uuid not null,student_id uuid not null,assessed_on date not null,weight_kg numeric(6,2) check(weight_kg>0 and weight_kg<1000),height_cm numeric(5,2) check(height_cm between 30 and 300),waist_cm numeric(5,2) check(waist_cm between 10 and 500),hip_cm numeric(5,2) check(hip_cm between 10 and 500),notes text check(char_length(notes)<=3000),shared boolean not null default true,created_at timestamptz not null default now(),foreign key(student_id,workspace_id) references public.evolva_students(id,workspace_id));
create table if not exists public.evolva_student_notes(student_id uuid primary key references public.evolva_students(id),body text not null check(char_length(body)<=10000),updated_at timestamptz not null default now());
create table if not exists public.evolva_events(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.evolva_workspaces(id),student_id uuid,title text not null check(char_length(trim(title)) between 2 and 150),starts_at timestamptz not null,ends_at timestamptz not null,status text not null default 'SCHEDULED' check(status in ('SCHEDULED','CONFIRMED','COMPLETED','CANCELLED')),location text check(char_length(location)<=300),notes text check(char_length(notes)<=2000),created_at timestamptz not null default now(),check(ends_at>starts_at and ends_at<=starts_at+interval '24 hours'),foreign key(student_id,workspace_id) references public.evolva_students(id,workspace_id));
create index if not exists evolva_events_period on public.evolva_events(workspace_id,starts_at);
create table if not exists public.evolva_messages(id uuid primary key default gen_random_uuid(),workspace_id uuid not null,student_id uuid not null,author_id uuid not null references auth.users(id),body text not null check(char_length(trim(body)) between 1 and 2000),request_id uuid not null,created_at timestamptz not null default now(),unique(author_id,request_id),foreign key(student_id,workspace_id) references public.evolva_students(id,workspace_id));
create table if not exists public.evolva_notifications(id uuid primary key default gen_random_uuid(),recipient_id uuid not null references auth.users(id),workspace_id uuid not null references public.evolva_workspaces(id),student_id uuid,title text not null,body text,read_at timestamptz,created_at timestamptz not null default now());
create index if not exists evolva_notifications_user on public.evolva_notifications(recipient_id,created_at desc);
create table if not exists public.evolva_charges(id uuid primary key default gen_random_uuid(),workspace_id uuid not null,student_id uuid not null,description text not null check(char_length(trim(description)) between 2 and 200),amount numeric(12,2) not null check(amount>0 and amount<=9999999999.99),due_on date not null,status text not null default 'OPEN' check(status in ('OPEN','PAID','CANCELLED')),request_id uuid not null,created_at timestamptz not null default now(),unique(workspace_id,request_id),foreign key(student_id,workspace_id) references public.evolva_students(id,workspace_id));
create table if not exists public.evolva_receipts(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.evolva_workspaces(id),charge_id uuid not null references public.evolva_charges(id),amount numeric(12,2) not null check(amount>0),method text not null check(method in ('PIX','CASH','DEBIT','CREDIT','TRANSFER')),actor_id uuid not null references auth.users(id),request_id uuid not null,created_at timestamptz not null default now(),reversed_at timestamptz,reversal_reason text,unique(workspace_id,request_id));
create table if not exists public.evolva_assets(id uuid primary key default gen_random_uuid(),workspace_id uuid not null,student_id uuid not null,path text not null unique,title text not null check(char_length(title) between 1 and 150),uploaded_by uuid not null references auth.users(id),created_at timestamptz not null default now(),foreign key(student_id,workspace_id) references public.evolva_students(id,workspace_id));
create table if not exists public.evolva_audit(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.evolva_workspaces(id),actor_id uuid,entity text not null,action text not null,record_id uuid,created_at timestamptz not null default now());
create index if not exists evolva_audit_store on public.evolva_audit(workspace_id,created_at desc);

create or replace function public.evolva_is_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.evolva_platform_admins where account_id=auth.uid());$$;
create or replace function public.evolva_can_write(p_workspace uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.evolva_subscriptions where workspace_id=p_workspace and status in ('TRIAL','ACTIVE') and valid_until>now());$$;
create or replace function public.evolva_trial() returns trigger language plpgsql security definer set search_path='' as $$begin insert into public.evolva_subscriptions values(new.id,'START','TRIAL',now()+interval '14 days',now()) on conflict do nothing;return new;end $$;
drop trigger if exists evolva_trial on public.evolva_workspaces;
create trigger evolva_trial after insert on public.evolva_workspaces for each row execute function public.evolva_trial();
insert into public.evolva_subscriptions select id,'START','TRIAL',now()+interval '14 days',now() from public.evolva_workspaces on conflict do nothing;
create or replace function public.evolva_write_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare w uuid;limit_value integer;begin
 if tg_table_name='evolva_charges' and tg_op='UPDATE' then
 if (to_jsonb(new)-'status')=(to_jsonb(old)-'status') then return new;end if;end if;
 if tg_table_name='evolva_events' and tg_op='UPDATE' then
 if new.status='CONFIRMED' and (to_jsonb(new)-'status')=(to_jsonb(old)-'status') then return new;end if;end if;
 w:=new.workspace_id;if w is null then return new;end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(w::text,1));
 if not public.evolva_can_write(w) then raise exception 'O período do plano terminou ou o acesso está suspenso. Consulte Assinatura.';end if;
 if tg_table_name='evolva_students' then
 if new.active then
 select p.max_students into limit_value from public.evolva_subscriptions s join public.evolva_plans p on p.code=s.plan_code where s.workspace_id=w;
 if (select count(*) from public.evolva_students where workspace_id=w and active and id<>new.id)>=limit_value then raise exception 'Limite de alunos ativos do plano atingido.';end if;
 end if;end if;return new;
end $$;
do $$ declare t text;begin foreach t in array array['evolva_students','evolva_exercises','evolva_workouts','evolva_assessments','evolva_events','evolva_charges'] loop
 execute format('drop trigger if exists evolva_plan_guard on public.%I',t);
 execute format('create trigger evolva_plan_guard before insert or update on public.%I for each row execute function public.evolva_write_guard()',t);end loop;end $$;
-- A revogação de acesso deve funcionar mesmo com assinatura expirada.
create or replace function public.evolva_revoke_access(p_student uuid) returns void language plpgsql security definer set search_path='' as $$
declare s public.evolva_students%rowtype;begin
 select * into s from public.evolva_students where id=p_student for update;
 if not found or not public.evolva_is_trainer(s.workspace_id) then raise exception 'Aluno indisponível.';end if;
 perform set_config('evolva.revoke','on',true);
 update public.evolva_students set account_id=null where id=s.id;
 perform set_config('evolva.revoke','off',true);
 update public.evolva_invitations set revoked_at=now() where student_id=s.id and revoked_at is null;
end $$;
-- O bypass só serve para a alteração exata de revogação feita pela RPC.
create or replace function public.evolva_write_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare w uuid;limit_value integer;begin
 if tg_table_name='evolva_students' and tg_op='UPDATE' then
 if current_setting('evolva.revoke',true)='on' and new.account_id is null and (to_jsonb(new)-'account_id')=(to_jsonb(old)-'account_id') then return new;end if;
 end if;
 if tg_table_name='evolva_charges' and tg_op='UPDATE' then
 if (to_jsonb(new)-'status')=(to_jsonb(old)-'status') then return new;end if;end if;
 if tg_table_name='evolva_events' and tg_op='UPDATE' then
 if new.status='CONFIRMED' and (to_jsonb(new)-'status')=(to_jsonb(old)-'status') then return new;end if;end if;
 w:=new.workspace_id;if w is null then return new;end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(w::text,1));
 if not public.evolva_can_write(w) then raise exception 'O período do plano terminou ou o acesso está suspenso. Consulte Assinatura.';end if;
 if tg_table_name='evolva_students' then
 if new.active then
 select p.max_students into limit_value from public.evolva_subscriptions s join public.evolva_plans p on p.code=s.plan_code where s.workspace_id=w;
 if (select count(*) from public.evolva_students where workspace_id=w and active and id<>new.id)>=limit_value then raise exception 'Limite de alunos ativos do plano atingido.';end if;
 end if;end if;return new;
end $$;
create or replace function public.evolva_audit_write() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.evolva_audit(workspace_id,actor_id,entity,action,record_id) values(new.workspace_id,auth.uid(),tg_table_name,tg_op,new.id);return new;end $$;
do $$ declare t text;begin foreach t in array array['evolva_students','evolva_workouts','evolva_assessments','evolva_events','evolva_charges','evolva_receipts','evolva_assets'] loop
 execute format('drop trigger if exists evolva_audit_write on public.%I',t);
 execute format('create trigger evolva_audit_write after insert or update on public.%I for each row execute function public.evolva_audit_write()',t);end loop;end $$;

-- RLS das novas entidades. Dados clínicos não são liberados ao admin da plataforma.
do $$ declare t text;p record;begin foreach t in array array['evolva_plans','evolva_subscriptions','evolva_platform_admins','evolva_plan_requests','evolva_assessments','evolva_student_notes','evolva_events','evolva_messages','evolva_notifications','evolva_charges','evolva_receipts','evolva_assets','evolva_audit'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);
 for p in select policyname from pg_policies where schemaname='public' and tablename=t loop execute format('drop policy %I on public.%I',p.policyname,t);end loop;
 if t not in ('evolva_platform_admins') then execute format('grant select on public.%I to authenticated',t);end if;
 end loop;end $$;
create policy evolva_plan_read on public.evolva_plans for select to authenticated using(true);
create policy evolva_subscription_read on public.evolva_subscriptions for select to authenticated using(public.evolva_is_trainer(workspace_id));
create policy evolva_plan_request_read on public.evolva_plan_requests for select to authenticated using(public.evolva_is_trainer(workspace_id));
create policy evolva_assessment_read on public.evolva_assessments for select to authenticated using(public.evolva_is_trainer(workspace_id) or (shared and public.evolva_is_student(student_id)));
create policy evolva_note_read on public.evolva_student_notes for select to authenticated using(exists(select 1 from public.evolva_students s where s.id=student_id and public.evolva_is_trainer(s.workspace_id)));
create policy evolva_event_read on public.evolva_events for select to authenticated using(public.evolva_is_trainer(workspace_id) or public.evolva_is_student(student_id));
create policy evolva_message_read on public.evolva_messages for select to authenticated using(public.evolva_is_trainer(workspace_id) or public.evolva_is_student(student_id));
create policy evolva_notification_read on public.evolva_notifications for select to authenticated using(recipient_id=auth.uid() and (public.evolva_is_trainer(workspace_id) or public.evolva_is_student(student_id)));
create policy evolva_charge_read on public.evolva_charges for select to authenticated using(public.evolva_is_trainer(workspace_id) or public.evolva_is_student(student_id));
create policy evolva_receipt_read on public.evolva_receipts for select to authenticated using(public.evolva_is_trainer(workspace_id) or exists(select 1 from public.evolva_charges c where c.id=charge_id and public.evolva_is_student(c.student_id)));
create policy evolva_asset_read on public.evolva_assets for select to authenticated using(public.evolva_is_trainer(workspace_id) or public.evolva_is_student(student_id));
create policy evolva_audit_read on public.evolva_audit for select to authenticated using(public.evolva_is_trainer(workspace_id));

create or replace function public.evolva_save_profile(p_workspace uuid,p_name text,p_phone text,p_bio text,p_credential text) returns void language plpgsql security definer set search_path='' as $$
begin if not public.evolva_is_trainer(p_workspace) then raise exception 'Acesso restrito.';end if;if char_length(coalesce(p_phone,''))>50 or char_length(coalesce(p_bio,''))>2000 or char_length(coalesce(p_credential,''))>100 then raise exception 'Campos muito longos.';end if;update public.evolva_workspaces set name=trim(p_name),phone=p_phone,bio=p_bio,credential=p_credential where id=p_workspace;end $$;
create or replace function public.evolva_save_exercise(p_exercise uuid,p_name text,p_muscle text,p_equipment text,p_instructions text,p_video text,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
declare w uuid;begin select workspace_id into w from public.evolva_exercises where id=p_exercise;if w is null or not public.evolva_is_trainer(w) then raise exception 'Apenas exercícios próprios podem ser alterados.';end if;update public.evolva_exercises set name=trim(p_name),muscle_group=p_muscle,equipment=p_equipment,instructions=p_instructions,video_url=nullif(trim(p_video),''),active=p_active where id=p_exercise;end $$;
create or replace function public.evolva_save_private_note(p_student uuid,p_body text) returns void language plpgsql security definer set search_path='' as $$
begin if not exists(select 1 from public.evolva_students where id=p_student and public.evolva_is_trainer(workspace_id)) then raise exception 'Aluno indisponível.';end if;insert into public.evolva_student_notes values(p_student,p_body,now()) on conflict(student_id) do update set body=excluded.body,updated_at=now();end $$;
create or replace function public.evolva_add_assessment(p_student uuid,p_date date,p_weight numeric,p_height numeric,p_waist numeric,p_hip numeric,p_notes text,p_shared boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.evolva_students%rowtype;rid uuid;begin select * into s from public.evolva_students where id=p_student;if not found or not public.evolva_is_trainer(s.workspace_id) then raise exception 'Aluno indisponível.';end if;if p_date is null or not isfinite(p_date) or p_date>current_date then raise exception 'Data inválida.';end if;insert into public.evolva_assessments(workspace_id,student_id,assessed_on,weight_kg,height_cm,waist_cm,hip_cm,notes,shared) values(s.workspace_id,s.id,p_date,p_weight,p_height,p_waist,p_hip,p_notes,p_shared) returning id into rid;return rid;end $$;
create or replace function public.evolva_save_event(p_workspace uuid,p_event uuid,p_student uuid,p_title text,p_start timestamptz,p_end timestamptz,p_location text,p_notes text,p_status text) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;begin if not public.evolva_is_trainer(p_workspace) then raise exception 'Acesso restrito.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_workspace::text,2));
 if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end) then raise exception 'Horário inválido.';end if;
 if p_status is null or p_status not in ('SCHEDULED','CONFIRMED','COMPLETED','CANCELLED') then raise exception 'Status inválido.';end if;
 if p_student is not null and not exists(select 1 from public.evolva_students where id=p_student and workspace_id=p_workspace and active) then raise exception 'Aluno indisponível.';end if;
 if p_status in ('SCHEDULED','CONFIRMED') and exists(select 1 from public.evolva_events where workspace_id=p_workspace and id is distinct from p_event and status in ('SCHEDULED','CONFIRMED') and starts_at<p_end and ends_at>p_start) then raise exception 'Já existe atendimento neste horário.';end if;
 if p_event is null then insert into public.evolva_events(workspace_id,student_id,title,starts_at,ends_at,location,notes,status) values(p_workspace,p_student,p_title,p_start,p_end,p_location,p_notes,p_status) returning id into rid;
 else update public.evolva_events set student_id=p_student,title=p_title,starts_at=p_start,ends_at=p_end,location=p_location,notes=p_notes,status=p_status where id=p_event and workspace_id=p_workspace returning id into rid;if not found then raise exception 'Evento indisponível.';end if;end if;return rid;end $$;
create or replace function public.evolva_send_message(p_student uuid,p_body text,p_request uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.evolva_students%rowtype;rid uuid;recipient uuid;begin
 select * into s from public.evolva_students where id=p_student;
 if not found or not s.active or (not public.evolva_is_trainer(s.workspace_id) and not public.evolva_is_student(s.id)) then raise exception 'Conversa indisponível.';end if;
 if p_request is null then raise exception 'Identificador inválido.';end if;
 select id into rid from public.evolva_messages where author_id=auth.uid() and request_id=p_request;if found then return rid;end if;
 if (select count(*) from public.evolva_messages where author_id=auth.uid() and created_at>now()-interval '1 minute')>=30 then raise exception 'Aguarde antes de enviar outra mensagem.';end if;
 insert into public.evolva_messages(workspace_id,student_id,author_id,body,request_id) values(s.workspace_id,s.id,auth.uid(),trim(p_body),p_request) returning id into rid;
 recipient:=case when public.evolva_is_trainer(s.workspace_id) then s.account_id else (select owner_id from public.evolva_workspaces where id=s.workspace_id) end;
 if recipient is not null then insert into public.evolva_notifications(recipient_id,workspace_id,student_id,title,body) values(recipient,s.workspace_id,s.id,'Nova mensagem',left(trim(p_body),100));end if;return rid;end $$;
create or replace function public.evolva_read_notification(p_notification uuid) returns void language plpgsql security definer set search_path='' as $$begin update public.evolva_notifications set read_at=now() where id=p_notification and recipient_id=auth.uid();end $$;
create or replace function public.evolva_add_charge(p_student uuid,p_description text,p_amount numeric,p_due date,p_request uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.evolva_students%rowtype;rid uuid;begin
 select * into s from public.evolva_students where id=p_student;if not found or not public.evolva_is_trainer(s.workspace_id) then raise exception 'Aluno indisponível.';end if;
 if p_request is null or p_amount is null or p_amount<>round(p_amount,2) or p_due is null or not isfinite(p_due) then raise exception 'Confira valor e vencimento.';end if;
 select id into rid from public.evolva_charges where workspace_id=s.workspace_id and request_id=p_request;if found then return rid;end if;
 insert into public.evolva_charges(workspace_id,student_id,description,amount,due_on,request_id) values(s.workspace_id,s.id,p_description,p_amount,p_due,p_request) returning id into rid;return rid;end $$;
create or replace function public.evolva_record_receipt(p_charge uuid,p_amount numeric,p_method text,p_request uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.evolva_charges%rowtype;rid uuid;paid numeric;begin
 select workspace_id into c.workspace_id from public.evolva_charges where id=p_charge;
 if not public.evolva_is_trainer(c.workspace_id) then raise exception 'Cobrança indisponível.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(c.workspace_id::text,3));
 select * into c from public.evolva_charges where id=p_charge for update;
 select id into rid from public.evolva_receipts where workspace_id=c.workspace_id and request_id=p_request;if found then return rid;end if;
 if c.status<>'OPEN' or p_request is null or p_amount is null or p_amount<=0 or p_amount>9999999999.99 or p_amount<>round(p_amount,2) then raise exception 'Valor ou cobrança inválidos.';end if;
 select coalesce(sum(amount),0) into paid from public.evolva_receipts where charge_id=c.id and reversed_at is null;
 if p_amount>c.amount-paid then raise exception 'Valor maior que o saldo pendente.';end if;
 insert into public.evolva_receipts(workspace_id,charge_id,amount,method,actor_id,request_id) values(c.workspace_id,c.id,p_amount,p_method,auth.uid(),p_request) returning id into rid;
 if paid+p_amount=c.amount then update public.evolva_charges set status='PAID' where id=c.id;end if;return rid;end $$;
create or replace function public.evolva_reverse_receipt(p_receipt uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare r public.evolva_receipts%rowtype;begin select * into r from public.evolva_receipts where id=p_receipt;
 if not found or not public.evolva_is_trainer(r.workspace_id) then raise exception 'Recebimento indisponível.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(r.workspace_id::text,3));
 if char_length(trim(coalesce(p_reason,''))) not between 3 and 300 then raise exception 'Informe o motivo.';end if;
 update public.evolva_receipts set reversed_at=now(),reversal_reason=trim(p_reason) where id=r.id and reversed_at is null;
 update public.evolva_charges set status='OPEN' where id=r.charge_id and status='PAID';end $$;
create or replace function public.evolva_cancel_charge(p_charge uuid) returns void language plpgsql security definer set search_path='' as $$
declare c public.evolva_charges%rowtype;begin select * into c from public.evolva_charges where id=p_charge;
 if not found or not public.evolva_is_trainer(c.workspace_id) then raise exception 'Cobrança indisponível.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(c.workspace_id::text,3));
 if exists(select 1 from public.evolva_receipts where charge_id=c.id and reversed_at is null) then raise exception 'Estorne os recebimentos antes de cancelar.';end if;
 update public.evolva_charges set status='CANCELLED' where id=c.id;end $$;
create or replace function public.evolva_request_plan(p_workspace uuid,p_plan text) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;begin if not public.evolva_is_trainer(p_workspace) then raise exception 'Acesso restrito.';end if;
 insert into public.evolva_plan_requests(workspace_id,plan_code) values(p_workspace,p_plan) on conflict(workspace_id) where status='PENDING' do update set plan_code=excluded.plan_code returning id into rid;return rid;end $$;
create or replace function public.evolva_platform_state() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin if not public.evolva_is_admin() then raise exception 'Acesso restrito à plataforma.';end if;
 return jsonb_build_object('workspaces',(select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'name',w.name,'email',u.email,'plan',s.plan_code,'status',s.status,'valid_until',s.valid_until,'students',(select count(*) from public.evolva_students where workspace_id=w.id and active))),'[]') from public.evolva_workspaces w join auth.users u on u.id=w.owner_id left join public.evolva_subscriptions s on s.workspace_id=w.id),'requests',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from public.evolva_plan_requests r where status='PENDING'));
end $$;
create or replace function public.evolva_admin_subscription(p_workspace uuid,p_plan text,p_status text,p_until timestamptz) returns void language plpgsql security definer set search_path='' as $$
begin if not public.evolva_is_admin() then raise exception 'Acesso restrito à plataforma.';end if;
 if p_status is null or p_status not in ('TRIAL','ACTIVE','SUSPENDED') or p_until is null or not isfinite(p_until) then raise exception 'Situação inválida.';end if;
 update public.evolva_subscriptions set plan_code=p_plan,status=p_status,valid_until=p_until,updated_at=now() where workspace_id=p_workspace;if not found then raise exception 'Empresa não encontrada.';end if;
 update public.evolva_plan_requests set status='APPROVED',resolved_at=now() where workspace_id=p_workspace and status='PENDING';
 insert into public.evolva_audit(workspace_id,actor_id,entity,action) values(p_workspace,auth.uid(),'subscription','UPDATE');end $$;
-- Permissões somente nas funções públicas da aplicação; triggers não são RPCs.
do $$ declare f record;begin for f in select p.oid::regprocedure signature,p.prorettype='trigger'::regtype is_trigger from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'evolva\_%' escape '\' loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 if not f.is_trigger then execute format('grant execute on function %s to authenticated',f.signature);end if;
 end loop;end $$;
commit;
-- Configuração administrativa exclusivamente pelo servidor/SQL Editor.
grant select,insert,update on public.evolva_platform_admins to service_role;
