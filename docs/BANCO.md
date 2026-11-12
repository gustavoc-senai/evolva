# Banco de dados

PostgreSQL/Supabase, com Auth para identidades e Storage para arquivos. Não há tabela de senhas na aplicação.

A migração `008_recursos_avancados.sql` acrescenta `video_path` aos exercícios, bucket privado `evolva-videos`, tabelas `evolva_templates`, `evolva_reminder_preferences` e `evolva_reminders`. As três tabelas usam RLS, leitura por vínculo e escrita por RPC; consentimento só pode ser concedido pelo aluno. As funções de processamento da fila são exclusivas de `service_role`. Consulte [a ativação dos recursos](RECURSOS_AVANCADOS.md).

| Tabela | Finalidade |
|---|---|
| evolva_workspaces | Espaço e perfil do personal |
| evolva_students | Cadastro do aluno e vínculo com sua conta |
| evolva_exercises | Biblioteca inicial e exercícios privados |
| evolva_workouts | Prescrição, aluno e estado de publicação |
| evolva_workout_items | Exercícios, ordem e prescrição de séries |
| evolva_invitations | Token, destinatário, validade e revogação |
| evolva_sessions | Sessão registrada e identificador de reenvio |
| evolva_set_logs | Séries realizadas, repetições e carga |
| evolva_checkins | Registro diário subjetivo do aluno |
| evolva_plans | Capacidade por plano |
| evolva_subscriptions | Situação e validade do espaço |
| evolva_platform_admins | Contas administrativas concedidas pelo servidor |
| evolva_plan_requests | Solicitações de mudança de plano |
| evolva_assessments | Medidas, observações e compartilhamento |
| evolva_student_notes | Anotações internas do personal |
| evolva_events | Agenda e situação dos atendimentos |
| evolva_messages | Conversas e autoria |
| evolva_notifications | Notificações individuais e leitura |
| evolva_charges | Cobranças do acompanhamento |
| evolva_receipts | Recebimentos e estornos internos |
| evolva_assets | Vínculo e autorização de fotos |
| evolva_audit | Histórico de operações e autor |
| evolva_workout_requests | Idempotência do editor de prescrições |

Todas têm RLS habilitada. Leitura é permitida por políticas; escrita direta do navegador é revogada. Funções SECURITY DEFINER verificam identidade, titularidade, vínculo e limites, com search_path fixo. Metadados editáveis de Auth não concedem papel administrativo.

As referências compostas impedem misturar aluno, treino, sessão e itens de espaços diferentes. Dados internos ficam separados dos dados compartilháveis. Planos e papel de administrador não podem ser alterados pelo próprio personal.

## Scripts

- `INSTALAR_COMPLETO.sql`: instalação única, concatenando migrações na ordem correta.
- `001_fundacao.sql`: primeira etapa (preservada).
- `002_verificar.sql`: verificação da primeira etapa.
- `003_aplicacao_completa.sql`: módulos operacionais, financeiro e planos.
- `004_storage.sql`: bucket privado e políticas de arquivos.
- `005_treinos_e_operacao.sql`: editor idempotente e confirmação de agenda.
- `006_limites_e_verificacao.sql`: regras de plano para registros do aluno.
- `007_verificar_completo.sql`: verificação final.

A tabela storage.objects pertence ao Supabase Storage; o instalador cria políticas, não recria sua estrutura. O serviço Auth também não é recriado em produção. Os testes possuem substitutos locais mínimos desses serviços para verificar o PostgreSQL.
