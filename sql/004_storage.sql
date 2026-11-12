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
