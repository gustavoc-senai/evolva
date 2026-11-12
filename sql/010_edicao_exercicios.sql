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
