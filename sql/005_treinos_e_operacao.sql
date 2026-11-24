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
