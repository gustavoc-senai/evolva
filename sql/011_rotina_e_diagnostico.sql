begin;
create table if not exists public.evolva_weekly_schedule (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.evolva_workspaces(id),
 student_id uuid not null references public.evolva_students(id),weekday integer not null check(weekday between 1 and 7),
 workout_id uuid not null references public.evolva_workouts(id),created_at timestamptz not null default now(),
 unique(student_id,weekday)
);
alter table public.evolva_weekly_schedule enable row level security;
revoke all on public.evolva_weekly_schedule from public,anon,authenticated;
grant select on public.evolva_weekly_schedule to authenticated;
drop policy if exists evolva_weekly_read on public.evolva_weekly_schedule;
create policy evolva_weekly_read on public.evolva_weekly_schedule for select to authenticated using(public.evolva_is_trainer(workspace_id) or public.evolva_is_student(student_id));
create or replace function public.evolva_save_weekly_schedule(p_student uuid,p_weekday integer,p_workout uuid) returns void language plpgsql security definer set search_path='' as $$
declare w uuid;begin
 select workspace_id into w from public.evolva_students where id=p_student and active;
 if w is null or not public.evolva_is_trainer(w) or not public.evolva_can_write(w) then raise exception 'Aluno indisponível para organizar a rotina.';end if;
 if p_weekday is null or p_weekday not between 1 and 7 then raise exception 'Escolha um dia válido.';end if;
 if p_workout is null then delete from public.evolva_weekly_schedule where student_id=p_student and weekday=p_weekday;return;end if;
 perform 1 from public.evolva_workouts where id=p_workout and student_id=p_student and workspace_id=w and status='PUBLISHED' for update;
 if not found then raise exception 'Selecione um treino publicado deste aluno.';end if;
 insert into public.evolva_weekly_schedule(workspace_id,student_id,weekday,workout_id) values(w,p_student,p_weekday,p_workout)
 on conflict(student_id,weekday) do update set workout_id=excluded.workout_id;
end $$;
revoke all on function public.evolva_save_weekly_schedule(uuid,integer,uuid) from public,anon;
grant execute on function public.evolva_save_weekly_schedule(uuid,integer,uuid) to authenticated;

-- A view preserva as políticas RLS das tabelas de origem (PostgreSQL 15+).
create or replace view public.evolva_student_set_logs with (security_invoker=true) as
 select l.*,s.student_id from public.evolva_set_logs l join public.evolva_sessions s on s.id=l.session_id;
revoke all on public.evolva_student_set_logs from public,anon,authenticated;
grant select on public.evolva_student_set_logs to authenticated;
create index if not exists evolva_workouts_student_status on public.evolva_workouts(student_id,status);
create index if not exists evolva_logs_session on public.evolva_set_logs(session_id);
create index if not exists evolva_notifications_unread on public.evolva_notifications(recipient_id,workspace_id,created_at desc) where read_at is null;

create or replace function public.evolva_setup_status() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not (exists(select 1 from public.evolva_workspaces where owner_id=auth.uid()) or public.evolva_is_admin()) then raise exception 'Acesso restrito ao professor ou administrador.';end if;
 return jsonb_build_array(
 jsonb_build_object('label','Vídeos privados e modelos','migration','008_recursos_avancados.sql','ready',to_regclass('public.evolva_templates') is not null and exists(select 1 from storage.buckets where id='evolva-videos' and not public)),
 jsonb_build_object('label','Edição dos exercícios iniciais','migration','010_edicao_exercicios.sql','ready',to_regprocedure('public.evolva_customize_exercise(uuid,uuid,text,text,text,text,text,boolean)') is not null),
 jsonb_build_object('label','Rotina semanal e consultas por aluno','migration','011_rotina_e_diagnostico.sql','ready',to_regclass('public.evolva_weekly_schedule') is not null and to_regclass('public.evolva_student_set_logs') is not null)
 );
end $$;
revoke all on function public.evolva_setup_status() from public,anon;
grant execute on function public.evolva_setup_status() to authenticated;
commit;
select 'Rotina semanal com RLS' as recurso,(select relrowsecurity from pg_class where oid='public.evolva_weekly_schedule'::regclass) as pronto
union all select 'Histórico respeita RLS',(select 'security_invoker=true'=any(reloptions) from pg_class where oid='public.evolva_student_set_logs'::regclass)
union all select 'Diagnóstico autenticado',not has_function_privilege('anon','public.evolva_setup_status()','execute');
