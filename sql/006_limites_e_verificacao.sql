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
