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
