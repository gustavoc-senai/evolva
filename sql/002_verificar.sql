-- Depois de executar 001, todas as linhas devem retornar true.
select 'Espaço do personal' as recurso,to_regclass('public.evolva_workspaces') is not null as pronto
union all select 'Alunos',to_regclass('public.evolva_students') is not null
union all select 'Biblioteca inicial',(select count(*)>=12 from public.evolva_exercises where workspace_id is null)
union all select 'Treinos',to_regclass('public.evolva_workouts') is not null
union all select 'Séries e cargas',to_regclass('public.evolva_set_logs') is not null
union all select 'Convites',to_regprocedure('public.evolva_accept_invitation(uuid)') is not null
union all select 'RLS de alunos',(select relrowsecurity from pg_class where oid=to_regclass('public.evolva_students'))
union all select 'Anônimo sem cadastro',not has_function_privilege('anon','public.evolva_create_workspace(text)','execute')
union all select 'Sem escrita direta de alunos',not has_table_privilege('authenticated','public.evolva_students','insert');
