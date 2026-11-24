-- EVOLVA 1.0 · execute inteiro no SQL Editor de um projeto Supabase novo.
-- Inclui todas as migrações e a verificação final. Não cria usuários ou senhas.

-- EVOLVA · etapa 1 · execute inteiro no SQL Editor de um projeto Supabase novo.
-- Não utiliza nem altera as tabelas do LojaControl.
begin;
create table if not exists public.evolva_workspaces (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null unique references auth.users(id) on delete restrict,
 name text not null check(char_length(trim(name)) between 2 and 100),
 created_at timestamptz not null default now()
);
create table if not exists public.evolva_students (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.evolva_workspaces(id),
 account_id uuid references auth.users(id) on delete set null,
 name text not null check(char_length(trim(name)) between 2 and 100),
 email text not null check(char_length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 phone text, goal text check(char_length(goal)<=1000),
 active boolean not null default true,created_at timestamptz not null default now(),
 unique(workspace_id,email),unique(id,workspace_id)
);
create unique index if not exists evolva_student_account on public.evolva_students(workspace_id,account_id) where account_id is not null;
create table if not exists public.evolva_exercises (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid references public.evolva_workspaces(id),
 name text not null check(char_length(trim(name)) between 2 and 150),
 muscle_group text not null check(char_length(trim(muscle_group)) between 2 and 60),
 equipment text not null check(char_length(equipment)<=100),
 instructions text check(char_length(instructions)<=3000),
 video_url text check(video_url is null or video_url ~ '^https://'),
 active boolean not null default true,created_at timestamptz not null default now()
);
create unique index if not exists evolva_global_exercise_name on public.evolva_exercises(lower(name)) where workspace_id is null;
create table if not exists public.evolva_workouts (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.evolva_workspaces(id),
 student_id uuid not null,
 title text not null check(char_length(trim(title)) between 2 and 100),
 notes text check(char_length(notes)<=2000),
 status text not null default 'DRAFT' check(status in ('DRAFT','PUBLISHED','ARCHIVED')),
 created_at timestamptz not null default now(),
 unique(id,workspace_id,student_id),
 foreign key(student_id,workspace_id) references public.evolva_students(id,workspace_id)
);
create table if not exists public.evolva_workout_items (
 id uuid primary key default gen_random_uuid(),
 workout_id uuid not null references public.evolva_workouts(id),
 exercise_id uuid not null references public.evolva_exercises(id),
 position integer not null check(position between 1 and 50),
 sets integer not null check(sets between 1 and 20),
 repetitions text not null check(char_length(trim(repetitions)) between 1 and 50),
 rest_seconds integer not null check(rest_seconds between 0 and 1800),
 notes text check(char_length(notes)<=500),
 unique(workout_id,position),unique(id,workout_id)
);
create table if not exists public.evolva_invitations (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references public.evolva_students(id),
 token uuid not null unique default gen_random_uuid(),
 email text not null,expires_at timestamptz not null default now()+interval '48 hours',
 accepted_at timestamptz,revoked_at timestamptz,created_at timestamptz not null default now()
);
create table if not exists public.evolva_sessions (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,student_id uuid not null,workout_id uuid not null,
 request_id uuid not null,effort integer check(effort between 1 and 10),
 notes text check(char_length(notes)<=1000),completed_at timestamptz not null default now(),
 unique(student_id,request_id),unique(id,workout_id),
 foreign key(workout_id,workspace_id,student_id) references public.evolva_workouts(id,workspace_id,student_id)
);
create table if not exists public.evolva_set_logs (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null,workout_id uuid not null,item_id uuid not null,
 set_number integer not null check(set_number between 1 and 20),
 repetitions integer not null check(repetitions between 0 and 500),
 load_kg numeric(8,2) check(load_kg between 0 and 9999),
 unique(session_id,item_id,set_number),
 foreign key(session_id,workout_id) references public.evolva_sessions(id,workout_id),
 foreign key(item_id,workout_id) references public.evolva_workout_items(id,workout_id)
);
create table if not exists public.evolva_checkins (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,student_id uuid not null,
 checkin_date date not null default (now() at time zone 'America/Sao_Paulo')::date,
 energy integer not null check(energy between 1 and 5),
 sleep_quality integer not null check(sleep_quality between 1 and 5),
 notes text check(char_length(notes)<=1000),created_at timestamptz not null default now(),
 unique(student_id,checkin_date),
 foreign key(student_id,workspace_id) references public.evolva_students(id,workspace_id)
);
create index if not exists evolva_students_account on public.evolva_students(account_id) where account_id is not null;
create index if not exists evolva_workouts_student on public.evolva_workouts(student_id,status);
create index if not exists evolva_sessions_student on public.evolva_sessions(student_id,completed_at desc);
create index if not exists evolva_invites_student on public.evolva_invitations(student_id);

create or replace function public.evolva_is_trainer(p_workspace uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.evolva_workspaces where id=p_workspace and owner_id=auth.uid());
$$;
create or replace function public.evolva_is_student(p_student uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.evolva_students where id=p_student and account_id=auth.uid() and active);
$$;
create or replace function public.evolva_can_read_workout(p_workout uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.evolva_workouts w where w.id=p_workout and (public.evolva_is_trainer(w.workspace_id) or (w.status='PUBLISHED' and public.evolva_is_student(w.student_id))));
$$;
-- Políticas explícitas; nenhum cliente ganha escrita direta no banco.
do $$ declare t text;pol record;begin
 foreach t in array array['evolva_workspaces','evolva_students','evolva_exercises','evolva_workouts','evolva_workout_items','evolva_invitations','evolva_sessions','evolva_set_logs','evolva_checkins'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 for pol in select policyname from pg_policies where schemaname='public' and tablename=t loop execute format('drop policy %I on public.%I',pol.policyname,t);end loop;
 if t<>'evolva_invitations' then execute format('grant select on public.%I to authenticated',t);end if;
 end loop;
end $$;
create policy evolva_workspace_read on public.evolva_workspaces for select to authenticated
 using(owner_id=auth.uid() or exists(select 1 from public.evolva_students s where s.workspace_id=evolva_workspaces.id and s.account_id=auth.uid() and s.active));
create policy evolva_student_read on public.evolva_students for select to authenticated using(public.evolva_is_trainer(workspace_id) or public.evolva_is_student(id));
create policy evolva_exercise_read on public.evolva_exercises for select to authenticated
 using(workspace_id is null or public.evolva_is_trainer(workspace_id) or exists(select 1 from public.evolva_workout_items i where i.exercise_id=evolva_exercises.id and public.evolva_can_read_workout(i.workout_id)));
create policy evolva_workout_read on public.evolva_workouts for select to authenticated using(public.evolva_can_read_workout(id));
create policy evolva_item_read on public.evolva_workout_items for select to authenticated using(public.evolva_can_read_workout(workout_id));
create policy evolva_session_read on public.evolva_sessions for select to authenticated using(public.evolva_is_trainer(workspace_id) or public.evolva_is_student(student_id));
create policy evolva_set_read on public.evolva_set_logs for select to authenticated using(exists(select 1 from public.evolva_sessions s where s.id=session_id));
create policy evolva_checkin_read on public.evolva_checkins for select to authenticated using(public.evolva_is_trainer(workspace_id) or public.evolva_is_student(student_id));

create or replace function public.evolva_create_workspace(p_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare rid uuid;begin
 if auth.uid() is null then raise exception 'Faça login.';end if;
 insert into public.evolva_workspaces(owner_id,name) values(auth.uid(),trim(p_name)) returning id into rid;return rid;
end $$;
create or replace function public.evolva_save_student(p_workspace uuid,p_student uuid,p_name text,p_email text,p_phone text,p_goal text,p_active boolean default true) returns uuid
language plpgsql security definer set search_path='' as $$
declare rid uuid;old_email text;linked uuid;begin
 if not public.evolva_is_trainer(p_workspace) then raise exception 'Acesso restrito ao personal.';end if;
 if p_student is null then
 insert into public.evolva_students(workspace_id,name,email,phone,goal,active) values(p_workspace,trim(p_name),lower(trim(p_email)),p_phone,p_goal,p_active) returning id into rid;
 else
 select email,account_id into old_email,linked from public.evolva_students where id=p_student and workspace_id=p_workspace for update;
 if not found then raise exception 'Aluno não encontrado.';end if;
 if linked is not null and old_email is distinct from lower(trim(p_email)) then raise exception 'Revogue o acesso antes de alterar o e-mail.';end if;
 update public.evolva_students set name=trim(p_name),email=lower(trim(p_email)),phone=p_phone,goal=p_goal,active=p_active where id=p_student returning id into rid;
 if old_email is distinct from lower(trim(p_email)) or not p_active then update public.evolva_invitations set revoked_at=now() where student_id=p_student and accepted_at is null and revoked_at is null;end if;
 end if;return rid;
end $$;
create or replace function public.evolva_invite_student(p_student uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.evolva_students%rowtype;t uuid;begin
 select * into s from public.evolva_students where id=p_student for update;
 if not found or not public.evolva_is_trainer(s.workspace_id) or not s.active then raise exception 'Aluno indisponível.';end if;
 if s.account_id is not null then raise exception 'Aluno já possui acesso.';end if;
 update public.evolva_invitations set revoked_at=now() where student_id=s.id and revoked_at is null and accepted_at is null;
 insert into public.evolva_invitations(student_id,email) values(s.id,s.email) returning token into t;return t;
end $$;
create or replace function public.evolva_accept_invitation(p_token uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare i public.evolva_invitations%rowtype;s public.evolva_students%rowtype;e text;sid uuid;begin
 if auth.uid() is null then raise exception 'Faça login.';end if;
 -- A mesma ordem de bloqueios é usada por emissão, aceite e revogação.
 select student_id into sid from public.evolva_invitations where token=p_token;
 select * into s from public.evolva_students where id=sid for update;
 select * into i from public.evolva_invitations where token=p_token for update;
 if not found or i.revoked_at is not null or i.expires_at<=now() or not s.active then raise exception 'Convite inválido ou expirado.';end if;
 select lower(email) into e from auth.users where id=auth.uid();
 if e is distinct from i.email or s.email is distinct from i.email then raise exception 'Entre com o e-mail convidado.';end if;
 if i.accepted_at is not null then if s.account_id=auth.uid() then return s.workspace_id;else raise exception 'Convite já utilizado.';end if;end if;
 if s.account_id is not null and s.account_id<>auth.uid() then raise exception 'Aluno já possui outra conta.';end if;
 update public.evolva_students set account_id=auth.uid() where id=s.id;
 update public.evolva_invitations set accepted_at=now() where id=i.id;return s.workspace_id;
end $$;
create or replace function public.evolva_revoke_access(p_student uuid) returns void
language plpgsql security definer set search_path='' as $$
declare s public.evolva_students%rowtype;begin
 select * into s from public.evolva_students where id=p_student for update;
 if not found or not public.evolva_is_trainer(s.workspace_id) then raise exception 'Aluno indisponível.';end if;
 update public.evolva_students set account_id=null where id=s.id;
 update public.evolva_invitations set revoked_at=now() where student_id=s.id and revoked_at is null;
end $$;
create or replace function public.evolva_add_exercise(p_workspace uuid,p_name text,p_muscle text,p_equipment text,p_instructions text,p_video text) returns uuid
language plpgsql security definer set search_path='' as $$
declare rid uuid;begin
 if not public.evolva_is_trainer(p_workspace) then raise exception 'Acesso restrito ao personal.';end if;
 insert into public.evolva_exercises(workspace_id,name,muscle_group,equipment,instructions,video_url) values(p_workspace,trim(p_name),trim(p_muscle),p_equipment,p_instructions,nullif(trim(p_video),'')) returning id into rid;return rid;
end $$;
create or replace function public.evolva_create_workout(p_student uuid,p_title text,p_notes text,p_items jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.evolva_students%rowtype;rid uuid;x record;n integer:=0;begin
 select * into s from public.evolva_students where id=p_student;
 if not found or not s.active or not public.evolva_is_trainer(s.workspace_id) then raise exception 'Aluno indisponível.';end if;
 if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Lista de exercícios inválida.';end if;
 if jsonb_array_length(p_items) not between 1 and 50 then raise exception 'Informe entre 1 e 50 exercícios.';end if;
 insert into public.evolva_workouts(workspace_id,student_id,title,notes) values(s.workspace_id,s.id,trim(p_title),p_notes) returning id into rid;
 for x in select * from jsonb_to_recordset(p_items) as item(exercise_id uuid,sets integer,repetitions text,rest_seconds integer,notes text) loop
 if not exists(select 1 from public.evolva_exercises where id=x.exercise_id and active and (workspace_id is null or workspace_id=s.workspace_id)) then raise exception 'Exercício indisponível.';end if;
 n:=n+1;insert into public.evolva_workout_items(workout_id,exercise_id,position,sets,repetitions,rest_seconds,notes) values(rid,x.exercise_id,n,x.sets,trim(x.repetitions),x.rest_seconds,x.notes);
 end loop;return rid;
end $$;
create or replace function public.evolva_workout_status(p_workout uuid,p_status text) returns void
language plpgsql security definer set search_path='' as $$
declare w public.evolva_workouts%rowtype;begin
 select * into w from public.evolva_workouts where id=p_workout for update;
 if not found or not public.evolva_is_trainer(w.workspace_id) then raise exception 'Treino indisponível.';end if;
 if p_status is null or p_status not in ('PUBLISHED','ARCHIVED') then raise exception 'Status inválido.';end if;
 if p_status='PUBLISHED' and not exists(select 1 from public.evolva_workout_items where workout_id=w.id) then raise exception 'Treino sem exercícios.';end if;
 update public.evolva_workouts set status=p_status where id=w.id;
end $$;
create or replace function public.evolva_complete_session(p_workout uuid,p_request uuid,p_effort integer,p_notes text,p_sets jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare w public.evolva_workouts%rowtype;rid uuid;x record;begin
 select * into w from public.evolva_workouts where id=p_workout for share;
 if not found or w.status<>'PUBLISHED' or not public.evolva_is_student(w.student_id) then raise exception 'Treino indisponível para este aluno.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(w.student_id::text,0));
 select id into rid from public.evolva_sessions where student_id=w.student_id and request_id=p_request;
 if found then if not exists(select 1 from public.evolva_sessions where id=rid and workout_id=w.id) then raise exception 'Identificador já utilizado.';end if;return rid;end if;
 if p_request is null or jsonb_typeof(p_sets) is distinct from 'array' then raise exception 'Registro inválido.';end if;
 if jsonb_array_length(p_sets) not between 1 and 1000 then raise exception 'Informe as séries realizadas.';end if;
 insert into public.evolva_sessions(workspace_id,student_id,workout_id,request_id,effort,notes) values(w.workspace_id,w.student_id,w.id,p_request,p_effort,p_notes) returning id into rid;
 for x in select * from jsonb_to_recordset(p_sets) as item(item_id uuid,set_number integer,repetitions integer,load_kg numeric) loop
 if not exists(select 1 from public.evolva_workout_items where id=x.item_id and workout_id=w.id and x.set_number between 1 and sets) then raise exception 'Série não pertence ao treino.';end if;
 insert into public.evolva_set_logs(session_id,workout_id,item_id,set_number,repetitions,load_kg) values(rid,w.id,x.item_id,x.set_number,x.repetitions,x.load_kg);
 end loop;return rid;
end $$;
create or replace function public.evolva_submit_checkin(p_student uuid,p_energy integer,p_sleep integer,p_notes text) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.evolva_students%rowtype;rid uuid;begin
 select * into s from public.evolva_students where id=p_student;
 if not found or not public.evolva_is_student(s.id) then raise exception 'Aluno indisponível.';end if;
 insert into public.evolva_checkins(workspace_id,student_id,energy,sleep_quality,notes) values(s.workspace_id,s.id,p_energy,p_sleep,p_notes)
 on conflict(student_id,checkin_date) do update set energy=excluded.energy,sleep_quality=excluded.sleep_quality,notes=excluded.notes returning id into rid;return rid;
end $$;
-- Somente funções desta aplicação; não altera permissões de funções alheias.
do $$ declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'evolva\_%' escape '\' loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;
-- Apenas nomes de exercícios; nenhuma prescrição é criada automaticamente.
insert into public.evolva_exercises(name,muscle_group,equipment) values
 ('Agachamento livre','Membros inferiores','Barra'),('Leg press','Membros inferiores','Máquina'),
 ('Cadeira extensora','Quadríceps','Máquina'),('Mesa flexora','Posteriores de coxa','Máquina'),
 ('Supino reto','Peitoral','Barra'),('Supino com halteres','Peitoral','Halteres'),
 ('Puxada frontal','Costas','Polia'),('Remada baixa','Costas','Polia'),
 ('Desenvolvimento com halteres','Ombros','Halteres'),('Elevação lateral','Ombros','Halteres'),
 ('Rosca direta','Bíceps','Barra'),('Tríceps na polia','Tríceps','Polia')
 on conflict(lower(name)) where workspace_id is null do nothing;
commit;


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


begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('evolva-progress','evolva-progress',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create or replace function public.evolva_asset_folder(p_path text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare w uuid;s uuid;begin
 if p_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$' then return false;end if;
 w:=split_part(p_path,'/',1)::uuid;s:=split_part(p_path,'/',2)::uuid;
 return exists(select 1 from public.evolva_students where id=s and workspace_id=w and active and (public.evolva_is_trainer(w) or public.evolva_is_student(s)));
 exception when invalid_text_representation then return false;
end $$;
create or replace function public.evolva_asset_read(p_path text) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.evolva_assets where path=p_path and (public.evolva_is_trainer(workspace_id) or public.evolva_is_student(student_id)));$$;
create or replace function public.evolva_asset_delete(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.evolva_assets where path=p_path and (public.evolva_is_trainer(workspace_id) or (uploaded_by=auth.uid() and public.evolva_is_student(student_id))));$$;
drop policy if exists evolva_upload on storage.objects;drop policy if exists evolva_download on storage.objects;drop policy if exists evolva_remove on storage.objects;
create policy evolva_upload on storage.objects for insert to authenticated with check(bucket_id='evolva-progress' and public.evolva_asset_folder(name));
create policy evolva_download on storage.objects for select to authenticated using(bucket_id='evolva-progress' and (public.evolva_asset_read(name) or (owner_id=auth.uid()::text and public.evolva_asset_folder(name))));
create policy evolva_remove on storage.objects for delete to authenticated using(bucket_id='evolva-progress' and (public.evolva_asset_delete(name) or (owner_id=auth.uid()::text and public.evolva_asset_folder(name))));
create or replace function public.evolva_register_asset(p_student uuid,p_path text,p_title text) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.evolva_students%rowtype;rid uuid;begin
 select * into s from public.evolva_students where id=p_student;
 if not found or not public.evolva_asset_folder(p_path) or split_part(p_path,'/',1)<>s.workspace_id::text or split_part(p_path,'/',2)<>s.id::text then raise exception 'Arquivo não autorizado.';end if;
 if not exists(select 1 from storage.objects where bucket_id='evolva-progress' and name=p_path and owner_id=auth.uid()::text) then raise exception 'Envie um arquivo da sua conta primeiro.';end if;
 insert into public.evolva_assets(workspace_id,student_id,path,title,uploaded_by) values(s.workspace_id,s.id,p_path,p_title,auth.uid()) on conflict(path) do nothing returning id into rid;
 if rid is null then select id into rid from public.evolva_assets where path=p_path and uploaded_by=auth.uid();end if;
 if rid is null then raise exception 'Arquivo já vinculado por outra conta.';end if;return rid;
end $$;
create or replace function public.evolva_unregister_asset(p_asset uuid) returns void language plpgsql security definer set search_path='' as $$
declare a public.evolva_assets%rowtype;begin select * into a from public.evolva_assets where id=p_asset;
 if not found or not public.evolva_asset_delete(a.path) then raise exception 'Arquivo indisponível.';end if;
 if exists(select 1 from storage.objects where bucket_id='evolva-progress' and name=a.path) then raise exception 'Remova o arquivo do Storage primeiro.';end if;
 delete from public.evolva_assets where id=a.id;end $$;
do $$ declare f record;begin for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('evolva_asset_folder','evolva_asset_read','evolva_asset_delete','evolva_register_asset','evolva_unregister_asset') loop execute format('revoke all on function %s from public,anon,authenticated',f.signature);execute format('grant execute on function %s to authenticated',f.signature);end loop;end $$;
commit;


begin;
create table if not exists public.evolva_workout_requests(workspace_id uuid not null references public.evolva_workspaces(id),request_id uuid not null,workout_id uuid not null references public.evolva_workouts(id),primary key(workspace_id,request_id));
alter table public.evolva_workout_requests enable row level security;
revoke all on public.evolva_workout_requests from public,anon,authenticated;
create or replace function public.evolva_save_workout(p_student uuid,p_workout uuid,p_title text,p_notes text,p_items jsonb,p_publish boolean,p_request uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.evolva_students%rowtype;w public.evolva_workouts%rowtype;rid uuid;x record;n integer:=0;begin
 select * into s from public.evolva_students where id=p_student;
 if not found or not s.active or not public.evolva_is_trainer(s.workspace_id) then raise exception 'Aluno indisponível.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(s.workspace_id::text,1));
 if not public.evolva_can_write(s.workspace_id) then raise exception 'Assinatura indisponível.';end if;
 if p_request is null or p_publish is null then raise exception 'Operação inválida.';end if;
 select workout_id into rid from public.evolva_workout_requests where workspace_id=s.workspace_id and request_id=p_request;if found then return rid;end if;
 if p_workout is null then rid:=public.evolva_create_workout(s.id,p_title,p_notes,p_items);
 else
 select * into w from public.evolva_workouts where id=p_workout and student_id=s.id for update;
 if not found or w.status<>'DRAFT' or exists(select 1 from public.evolva_sessions where workout_id=w.id) then raise exception 'Edite somente rascunhos. Para treinos publicados, crie uma nova versão.';end if;
 if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Exercícios inválidos.';end if;
 if jsonb_array_length(p_items) not between 1 and 50 then raise exception 'Informe de 1 a 50 exercícios.';end if;
 delete from public.evolva_workout_items where workout_id=w.id;
 for x in select * from jsonb_to_recordset(p_items) item(exercise_id uuid,sets integer,repetitions text,rest_seconds integer,notes text) loop
 if not exists(select 1 from public.evolva_exercises where id=x.exercise_id and active and (workspace_id is null or workspace_id=s.workspace_id)) then raise exception 'Exercício indisponível.';end if;
 n:=n+1;insert into public.evolva_workout_items(workout_id,exercise_id,position,sets,repetitions,rest_seconds,notes) values(w.id,x.exercise_id,n,x.sets,x.repetitions,x.rest_seconds,x.notes);
 end loop;
 update public.evolva_workouts set title=trim(p_title),notes=p_notes where id=w.id;rid:=w.id;
 end if;
 if p_publish then perform public.evolva_workout_status(rid,'PUBLISHED');end if;
 insert into public.evolva_workout_requests values(s.workspace_id,p_request,rid);
 if p_publish and s.account_id is not null then insert into public.evolva_notifications(recipient_id,workspace_id,student_id,title,body) values(s.account_id,s.workspace_id,s.id,'Novo treino disponível',trim(p_title));end if;
 return rid;
end $$;
revoke all on function public.evolva_save_workout(uuid,uuid,text,text,jsonb,boolean,uuid) from public,anon;
grant execute on function public.evolva_save_workout(uuid,uuid,text,text,jsonb,boolean,uuid) to authenticated;
create or replace function public.evolva_can_read_workout(p_workout uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.evolva_workouts w where w.id=p_workout and (public.evolva_is_trainer(w.workspace_id) or (w.status in ('PUBLISHED','ARCHIVED') and public.evolva_is_student(w.student_id))));
$$;
commit;
create or replace function public.evolva_confirm_event(p_event uuid) returns void language plpgsql security definer set search_path='' as $$
declare e public.evolva_events%rowtype;begin select * into e from public.evolva_events where id=p_event for update;
 if not found or not public.evolva_is_student(e.student_id) or e.status not in ('SCHEDULED','CONFIRMED') then raise exception 'Atendimento indisponível.';end if;
 update public.evolva_events set status='CONFIRMED' where id=e.id;end $$;
revoke all on function public.evolva_confirm_event(uuid) from public,anon;grant execute on function public.evolva_confirm_event(uuid) to authenticated;


begin;
create or replace function public.evolva_student_write_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin if not public.evolva_can_write(new.workspace_id) then raise exception 'O plano do acompanhamento não está disponível para novos registros. Entre em contato com o personal.';end if;return new;end $$;
revoke all on function public.evolva_student_write_guard() from public,anon,authenticated;
do $$ declare t text;begin foreach t in array array['evolva_sessions','evolva_checkins','evolva_messages','evolva_assets'] loop
 execute format('drop trigger if exists evolva_student_plan_guard on public.%I',t);
 execute format('create trigger evolva_student_plan_guard before insert or update on public.%I for each row execute function public.evolva_student_write_guard()',t);
 end loop;end $$;
-- Uploads novos são bloqueados antes de ocupar Storage quando o plano expira.
create or replace function public.evolva_asset_folder(p_path text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare w uuid;s uuid;begin
 if p_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$' then return false;end if;
 w:=split_part(p_path,'/',1)::uuid;s:=split_part(p_path,'/',2)::uuid;
 return public.evolva_can_write(w) and exists(select 1 from public.evolva_students where id=s and workspace_id=w and active and (public.evolva_is_trainer(w) or public.evolva_is_student(s)));
 exception when invalid_text_representation then return false;
end $$;
create index if not exists evolva_messages_student_date on public.evolva_messages(student_id,created_at desc);
create index if not exists evolva_assets_student_date on public.evolva_assets(student_id,created_at desc);
create index if not exists evolva_assessments_student_date on public.evolva_assessments(student_id,assessed_on desc);
create index if not exists evolva_charges_workspace_due on public.evolva_charges(workspace_id,due_on);
create index if not exists evolva_receipts_charge on public.evolva_receipts(charge_id);
create index if not exists evolva_sessions_workspace_date on public.evolva_sessions(workspace_id,completed_at desc);
create index if not exists evolva_items_exercise on public.evolva_workout_items(exercise_id);
create index if not exists evolva_exercises_workspace on public.evolva_exercises(workspace_id,active);
commit;


select 'Tabelas da aplicação' as recurso,(select count(*)>=23 from pg_tables where schemaname='public' and tablename like 'evolva\_%' escape '\') as pronto
union all select 'RLS em todas as tabelas',(select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname like 'evolva\_%' escape '\')
union all select 'Bucket privado',(select not public from storage.buckets where id='evolva-progress')
union all select 'Biblioteca inicial',(select count(*)>=12 from public.evolva_exercises where workspace_id is null)
union all select 'Editor de treino',to_regprocedure('public.evolva_save_workout(uuid,uuid,text,text,jsonb,boolean,uuid)') is not null
union all select 'Financeiro',to_regprocedure('public.evolva_record_receipt(uuid,numeric,text,uuid)') is not null
union all select 'Aluno sem escrita direta',not has_table_privilege('authenticated','public.evolva_students','insert')
union all select 'Admin não é autoatribuível',not has_table_privilege('authenticated','public.evolva_platform_admins','insert')
union all select 'Anônimo sem sessão',not has_function_privilege('anon','public.evolva_complete_session(uuid,uuid,integer,text,jsonb)','execute');


-- RECURSOS AVANCADOS 008
begin;
alter table public.evolva_exercises add column if not exists video_path text;
create unique index if not exists evolva_video_path_unique on public.evolva_exercises(video_path) where video_path is not null;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('evolva-videos','evolva-videos',false,52428800,array['video/mp4','video/webm','video/quicktime'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.evolva_video_upload(p_path text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare w uuid;begin
 if p_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(mp4|webm|mov)$' then return false;end if;
 w:=split_part(p_path,'/',1)::uuid;
 return public.evolva_is_trainer(w) and public.evolva_can_write(w);
 exception when invalid_text_representation then return false;
end $$;
create or replace function public.evolva_video_read(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.evolva_exercises e where e.video_path=p_path and
 (public.evolva_is_trainer(e.workspace_id) or exists(select 1 from public.evolva_workout_items i join public.evolva_workouts w on w.id=i.workout_id where i.exercise_id=e.id and w.status in ('PUBLISHED','ARCHIVED') and public.evolva_is_student(w.student_id))));
$$;
drop policy if exists evolva_video_insert on storage.objects;
create policy evolva_video_insert on storage.objects for insert to authenticated with check(bucket_id='evolva-videos' and public.evolva_video_upload(name));
drop policy if exists evolva_video_select on storage.objects;
create policy evolva_video_select on storage.objects for select to authenticated using(bucket_id='evolva-videos' and (public.evolva_video_read(name) or (owner_id=auth.uid()::text and public.evolva_video_upload(name))));
drop policy if exists evolva_video_delete on storage.objects;
create policy evolva_video_delete on storage.objects for delete to authenticated using(bucket_id='evolva-videos' and public.evolva_video_upload(name) and not exists(select 1 from public.evolva_exercises e where e.video_path=name));
create or replace function public.evolva_attach_video(p_exercise uuid,p_path text) returns void language plpgsql security definer set search_path='' as $$
declare e public.evolva_exercises%rowtype;begin
 select * into e from public.evolva_exercises where id=p_exercise for update;
 if not found or not public.evolva_is_trainer(e.workspace_id) or not public.evolva_can_write(e.workspace_id) then raise exception 'Exercício indisponível.';end if;
 if p_path is not null and (split_part(p_path,'/',1)<>e.workspace_id::text or not public.evolva_video_upload(p_path) or not exists(select 1 from storage.objects where bucket_id='evolva-videos' and name=p_path and owner_id=auth.uid()::text)) then raise exception 'Envie um vídeo da sua conta neste espaço primeiro.';end if;
 update public.evolva_exercises set video_path=p_path,video_url=case when p_path is null then video_url else null end where id=e.id;
end $$;

create table if not exists public.evolva_templates(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.evolva_workspaces(id),
 title text not null check(length(trim(title)) between 1 and 150),notes text,items jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.evolva_templates enable row level security;
revoke all on public.evolva_templates from public,anon,authenticated;
grant select on public.evolva_templates to authenticated;
drop policy if exists evolva_template_read on public.evolva_templates;
create policy evolva_template_read on public.evolva_templates for select to authenticated using(public.evolva_is_trainer(workspace_id));
create or replace function public.evolva_create_template(p_workout uuid,p_title text) returns uuid language plpgsql security definer set search_path='' as $$
declare w public.evolva_workouts%rowtype;rid uuid;payload jsonb;begin
 select * into w from public.evolva_workouts where id=p_workout;
 if not found or not public.evolva_is_trainer(w.workspace_id) or not public.evolva_can_write(w.workspace_id) then raise exception 'Treino indisponível.';end if;
 select jsonb_agg(jsonb_build_object('exercise_id',exercise_id,'sets',sets,'repetitions',repetitions,'rest_seconds',rest_seconds,'notes',notes) order by position) into payload from public.evolva_workout_items where workout_id=w.id;
 if payload is null then raise exception 'O treino precisa ter exercícios.';end if;
 insert into public.evolva_templates(workspace_id,title,notes,items) values(w.workspace_id,trim(p_title),w.notes,payload) returning id into rid;return rid;
end $$;
create or replace function public.evolva_delete_template(p_template uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.evolva_templates where id=p_template and public.evolva_is_trainer(workspace_id)) then raise exception 'Modelo indisponível.';end if;
 delete from public.evolva_templates where id=p_template;
end $$;

create table if not exists public.evolva_reminder_preferences(
 student_id uuid primary key references public.evolva_students(id),workspace_id uuid not null references public.evolva_workspaces(id),
 account_id uuid not null references auth.users(id),email_enabled boolean not null default false,whatsapp_enabled boolean not null default false,
 whatsapp_phone text,updated_at timestamptz not null default now()
);
create table if not exists public.evolva_reminders(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.evolva_workspaces(id),student_id uuid not null references public.evolva_students(id),
 channel text not null check(channel in ('EMAIL','WHATSAPP')),event_id uuid references public.evolva_events(id),workout_id uuid references public.evolva_workouts(id),
 due_at timestamptz not null,status text not null default 'PENDING' check(status in ('PENDING','PROCESSING','SENT','FAILED','CANCELLED','UNCERTAIN')),
 created_at timestamptz not null default now(),processed_at timestamptz,provider_id text,
 check((event_id is null)<>(workout_id is null))
);
create unique index if not exists evolva_reminder_event_unique on public.evolva_reminders(event_id,channel) where event_id is not null;
create unique index if not exists evolva_reminder_workout_unique on public.evolva_reminders(workout_id,channel) where workout_id is not null;
create index if not exists evolva_reminder_pending on public.evolva_reminders(due_at) where status='PENDING';
alter table public.evolva_reminder_preferences enable row level security;
alter table public.evolva_reminders enable row level security;
revoke all on public.evolva_reminder_preferences,public.evolva_reminders from public,anon,authenticated;
grant select on public.evolva_reminder_preferences,public.evolva_reminders to authenticated;
drop policy if exists evolva_preferences_read on public.evolva_reminder_preferences;
create policy evolva_preferences_read on public.evolva_reminder_preferences for select to authenticated using(public.evolva_is_trainer(workspace_id) or public.evolva_is_student(student_id));
drop policy if exists evolva_reminders_read on public.evolva_reminders;
create policy evolva_reminders_read on public.evolva_reminders for select to authenticated using(public.evolva_is_trainer(workspace_id) or public.evolva_is_student(student_id));
create or replace function public.evolva_save_reminder_preferences(p_student uuid,p_email boolean,p_whatsapp boolean,p_phone text) returns void language plpgsql security definer set search_path='' as $$
declare w uuid;begin
 if not public.evolva_is_student(p_student) then raise exception 'Somente o aluno pode autorizar lembretes.';end if;
 if p_whatsapp and coalesce(p_phone,'') !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'Use telefone internacional: +5511999999999.';end if;
 select workspace_id into w from public.evolva_students where id=p_student;
 insert into public.evolva_reminder_preferences(student_id,workspace_id,account_id,email_enabled,whatsapp_enabled,whatsapp_phone,updated_at) values(p_student,w,auth.uid(),p_email,p_whatsapp,nullif(trim(p_phone),''),now()) on conflict(student_id) do update set account_id=excluded.account_id,email_enabled=excluded.email_enabled,whatsapp_enabled=excluded.whatsapp_enabled,whatsapp_phone=excluded.whatsapp_phone,updated_at=now();
 update public.evolva_reminders set status='CANCELLED' where student_id=p_student and status='PENDING' and ((channel='EMAIL' and not p_email) or (channel='WHATSAPP' and not p_whatsapp));
end $$;
create or replace function public.evolva_queue_reminder(p_event uuid,p_workout uuid,p_channel text) returns uuid language plpgsql security definer set search_path='' as $$
declare s uuid;w uuid;at_time timestamptz;rid uuid;p public.evolva_reminder_preferences%rowtype;begin
 if (p_event is null)=(p_workout is null) or p_channel not in ('EMAIL','WHATSAPP') then raise exception 'Selecione um atendimento ou treino e um canal válido.';end if;
 if p_event is not null then
 select student_id,workspace_id,greatest(now(),starts_at-interval '1 hour') into s,w,at_time from public.evolva_events where id=p_event and status in ('SCHEDULED','CONFIRMED') and starts_at>now();
 else
 select student_id,workspace_id,now() into s,w,at_time from public.evolva_workouts where id=p_workout and status='PUBLISHED';
 end if;
 if s is null or not public.evolva_is_trainer(w) or not public.evolva_can_write(w) then raise exception 'Registro indisponível para lembrete.';end if;
 if not exists(select 1 from public.evolva_students where id=s and active and account_id is not null) then raise exception 'O aluno precisa aceitar o convite primeiro.';end if;
 select * into p from public.evolva_reminder_preferences where student_id=s;
 if not found or p.account_id is distinct from (select account_id from public.evolva_students where id=s) or (p_channel='EMAIL' and not p.email_enabled) or (p_channel='WHATSAPP' and not p.whatsapp_enabled) then raise exception 'O aluno ainda não autorizou este canal em Configurações.';end if;
 insert into public.evolva_reminders(workspace_id,student_id,channel,event_id,workout_id,due_at) values(w,s,p_channel,p_event,p_workout,at_time) on conflict do nothing returning id into rid;
 if rid is null then select id into rid from public.evolva_reminders where channel=p_channel and (event_id=p_event or workout_id=p_workout);end if;
 return rid;
end $$;
create or replace function public.evolva_cancel_reminder(p_reminder uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.evolva_reminders set status='CANCELLED' where id=p_reminder and status='PENDING' and (public.evolva_is_trainer(workspace_id) or public.evolva_is_student(student_id));
 if not found then raise exception 'Só é possível cancelar lembretes pendentes autorizados.';end if;
end $$;
-- Worker exclusivo do servidor. Não disponibiliza contatos para usuários anônimos.
create or replace function public.evolva_claim_reminders(p_email boolean,p_whatsapp boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare r record;result jsonb:='[]';p public.evolva_reminder_preferences%rowtype;s public.evolva_students%rowtype;ev public.evolva_events%rowtype;wk public.evolva_workouts%rowtype;begin
 update public.evolva_reminders set status='UNCERTAIN' where status='PROCESSING' and processed_at<now()-interval '10 minutes';
 for r in select * from public.evolva_reminders where status='PENDING' and due_at<=now() and ((channel='EMAIL' and p_email) or (channel='WHATSAPP' and p_whatsapp)) order by due_at for update skip locked limit 5 loop
 select * into s from public.evolva_students where id=r.student_id;
 select * into p from public.evolva_reminder_preferences where student_id=r.student_id;
 select * into ev from public.evolva_events where id=r.event_id;
 select * into wk from public.evolva_workouts where id=r.workout_id;
 if s.account_id is null or not s.active or not public.evolva_can_write(r.workspace_id) or p.student_id is null or p.account_id is distinct from s.account_id or (r.channel='EMAIL' and not p.email_enabled) or (r.channel='WHATSAPP' and not p.whatsapp_enabled) or (r.event_id is not null and (ev.id is null or ev.student_id is distinct from s.id or ev.status not in ('SCHEDULED','CONFIRMED') or ev.starts_at<=now())) or (r.workout_id is not null and (wk.id is null or wk.student_id is distinct from s.id or wk.status<>'PUBLISHED')) then
 update public.evolva_reminders set status='CANCELLED' where id=r.id;continue;end if;
 -- Se a agenda mudou, respeita o horário atualizado antes do envio.
 if r.event_id is not null and ev.starts_at-interval '1 hour'>now() then update public.evolva_reminders set due_at=ev.starts_at-interval '1 hour' where id=r.id;continue;end if;
 update public.evolva_reminders set status='PROCESSING',processed_at=now() where id=r.id;
 result:=result||jsonb_build_array(jsonb_build_object('id',r.id,'channel',r.channel,'email',s.email,'phone',p.whatsapp_phone,'kind',case when r.event_id is not null then 'EVENT' else 'WORKOUT' end,'starts_at',ev.starts_at));
 end loop;return result;
end $$;
create or replace function public.evolva_finish_reminder(p_id uuid,p_status text,p_provider text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_status not in ('SENT','FAILED','UNCERTAIN') then raise exception 'Resultado inválido.';end if;
 update public.evolva_reminders set status=p_status,provider_id=left(p_provider,200),processed_at=now() where id=p_id and status='PROCESSING';
end $$;
do $$ declare f record;begin
 for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('evolva_video_upload','evolva_video_read','evolva_attach_video','evolva_create_template','evolva_delete_template','evolva_save_reminder_preferences','evolva_queue_reminder','evolva_cancel_reminder','evolva_claim_reminders','evolva_finish_reminder') loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 if f.proname in ('evolva_claim_reminders','evolva_finish_reminder') then execute format('grant execute on function %s to service_role',f.signature);
 else execute format('grant execute on function %s to authenticated',f.signature);end if;
 end loop;
end $$;
commit;
select 'Modelos com RLS' as recurso,(select relrowsecurity from pg_class where oid='public.evolva_templates'::regclass) as pronto
union all select 'Fila com RLS',(select relrowsecurity from pg_class where oid='public.evolva_reminders'::regclass)
union all select 'Preferências com RLS',(select relrowsecurity from pg_class where oid='public.evolva_reminder_preferences'::regclass)
union all select 'Vídeos privados',(select not public from storage.buckets where id='evolva-videos')
union all select 'Worker bloqueado no navegador',not has_function_privilege('authenticated','public.evolva_claim_reminders(boolean,boolean)','execute')
union all select 'Worker habilitado no servidor',has_function_privilege('service_role','public.evolva_claim_reminders(boolean,boolean)','execute');


-- EDICAO EXERCICIOS 010
begin;
alter table public.evolva_exercises add column if not exists source_exercise_id uuid references public.evolva_exercises(id);
create unique index if not exists evolva_exercise_override on public.evolva_exercises(workspace_id,source_exercise_id) where source_exercise_id is not null;

create or replace function public.evolva_customize_exercise(p_workspace uuid,p_source uuid,p_name text,p_muscle text,p_equipment text,p_instructions text,p_video text,p_active boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;begin
 if not public.evolva_is_trainer(p_workspace) or not public.evolva_can_write(p_workspace) then raise exception 'Seu espaço não está disponível para edição.';end if;
 if not exists(select 1 from public.evolva_exercises where id=p_source and workspace_id is null) then raise exception 'Exercício inicial indisponível.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_workspace::text||p_source::text,7));
 insert into public.evolva_exercises(workspace_id,source_exercise_id,name,muscle_group,equipment,instructions,video_url,active)
 values(p_workspace,p_source,trim(p_name),trim(p_muscle),p_equipment,p_instructions,nullif(trim(p_video),''),p_active)
 on conflict(workspace_id,source_exercise_id) where source_exercise_id is not null
 do update set name=excluded.name,muscle_group=excluded.muscle_group,equipment=excluded.equipment,instructions=excluded.instructions,video_url=excluded.video_url,active=excluded.active
 returning id into rid;
 -- Mantém os IDs dos itens, a prescrição e todos os registros de séries.
 update public.evolva_workout_items i set exercise_id=rid from public.evolva_workouts w where i.workout_id=w.id and w.workspace_id=p_workspace and i.exercise_id=p_source;
 if to_regclass('public.evolva_templates') is not null then
 update public.evolva_templates t set items=(select jsonb_agg(case when item->>'exercise_id'=p_source::text then jsonb_set(item,'{exercise_id}',to_jsonb(rid::text)) else item end order by position) from jsonb_array_elements(t.items) with ordinality as entry(item,position)) where workspace_id=p_workspace and exists(select 1 from jsonb_array_elements(t.items) item where item->>'exercise_id'=p_source::text);
 end if;
 return rid;
end $$;
revoke all on function public.evolva_customize_exercise(uuid,uuid,text,text,text,text,text,boolean) from public,anon;
grant execute on function public.evolva_customize_exercise(uuid,uuid,text,text,text,text,text,boolean) to authenticated;

-- Resolve também prescrições salvas por uma aba aberta antes da personalização.
create or replace function public.evolva_resolve_exercise_override() returns trigger language plpgsql security definer set search_path='' as $$
declare replacement uuid;enabled boolean;begin
 select e.id,e.active into replacement,enabled from public.evolva_exercises e join public.evolva_workouts w on w.workspace_id=e.workspace_id where w.id=new.workout_id and e.source_exercise_id=new.exercise_id;
 if replacement is not null then
 if not enabled then raise exception 'O exercício personalizado está inativo. Reative-o antes de criar uma prescrição.';end if;
 new.exercise_id:=replacement;end if;
 return new;
end $$;
revoke all on function public.evolva_resolve_exercise_override() from public,anon,authenticated;
drop trigger if exists evolva_resolve_exercise_override on public.evolva_workout_items;
create trigger evolva_resolve_exercise_override before insert or update of exercise_id on public.evolva_workout_items for each row execute function public.evolva_resolve_exercise_override();
commit;
select 'Edição da biblioteca por professor' as recurso,to_regprocedure('public.evolva_customize_exercise(uuid,uuid,text,text,text,text,text,boolean)') is not null as pronto;
