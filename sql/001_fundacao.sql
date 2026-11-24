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
