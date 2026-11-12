select 'Tabelas da aplicação' as recurso,(select count(*)>=23 from pg_tables where schemaname='public' and tablename like 'evolva\_%' escape '\') as pronto
union all select 'RLS em todas as tabelas',(select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname like 'evolva\_%' escape '\')
union all select 'Bucket privado',(select not public from storage.buckets where id='evolva-progress')
union all select 'Biblioteca inicial',(select count(*)>=12 from public.evolva_exercises where workspace_id is null)
union all select 'Editor de treino',to_regprocedure('public.evolva_save_workout(uuid,uuid,text,text,jsonb,boolean,uuid)') is not null
union all select 'Financeiro',to_regprocedure('public.evolva_record_receipt(uuid,numeric,text,uuid)') is not null
union all select 'Aluno sem escrita direta',not has_table_privilege('authenticated','public.evolva_students','insert')
union all select 'Admin não é autoatribuível',not has_table_privilege('authenticated','public.evolva_platform_admins','insert')
union all select 'Anônimo sem sessão',not has_function_privilege('anon','public.evolva_complete_session(uuid,uuid,integer,text,jsonb)','execute');
