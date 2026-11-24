# Ativar os novos recursos

## Editar exercícios iniciais

Execute também `sql/010_edicao_exercicios.sql` no SQL Editor para habilitar **Editar** nos exercícios da biblioteca inicial. O professor salva uma versão exclusiva do próprio espaço; seus treinos e modelos passam a usar essa versão, mantendo IDs dos itens e histórico de séries. A biblioteca dos outros profissionais é preservada. As versões personalizadas substituem o original na listagem do professor. Prescrições salvas por abas antigas também resolvem a versão personalizada no servidor.

No editor de treinos, selecionar um exercício mostra orientações, vídeo e um link para editar em outra aba. Após salvar nessa aba, atualize os dados no topo do editor de treinos.

## Atualização do banco

Como a instalação anterior já foi executada, abra o SQL Editor do seu Supabase e execute **sql/008_recursos_avancados.sql inteiro**. A migração pode ser repetida e preserva os dados. Ela cria modelos, preferências e fila de lembretes, além do bucket privado de vídeos. Não execute o arquivo 009 antes de configurar os envios.

Novas instalações podem usar apenas `sql/INSTALAR_COMPLETO.sql`, que inclui a atualização.

## Vídeos

Em Exercícios → Editar/Novo exercício, envie MP4, WebM ou MOV de até 50 MB, ou informe um link HTTPS. O upload ocorre ao salvar. O bucket `evolva-videos` é privado: somente o professor do espaço e alunos com prescrição publicada/histórica que use o exercício recebem URLs temporárias. Revogar o vínculo bloqueia novas URLs; URLs já emitidas podem durar até 15 minutos. A tela renova as URLs enquanto o vídeo está aberto.

Vídeos MOV dependem do suporte do navegador; MP4 é a opção mais compatível. O sistema não converte vídeos. O envio usa a API de Storage; se houver interrupção, edite o exercício já salvo e tente novamente. Não há upload em segundo plano após fechar a página. Ao duplicar um exercício com arquivo privado, reenvie o vídeo para a cópia; links externos são copiados.

Substituição/remoção desvincula o vídeo e tenta apagar o arquivo antigo. Uma falha de rede pode deixar arquivo órfão: revise no Storage antes de remover arquivos sem vínculo. Nunca apague arquivos vinculados ou diretamente por SQL. Limites de tráfego/armazenamento pertencem ao seu projeto Supabase.

## Modelos, calendário, alertas e gráficos

- Treinos → Salvar como modelo guarda uma cópia da estrutura e das orientações gerais. Revise as orientações para não incluir dados pessoais no modelo. Modelos são privados do professor; usar um modelo abre o editor sem escolher aluno automaticamente. Exercícios inativos/excluídos ou de outro espaço são rejeitados pelo servidor na criação do treino.
- Agenda → Semana/Mês permite navegar por períodos e selecionar um dia para consultar a lista. Os horários são mostrados no fuso do navegador.
- O painel mostra alunos ativos sem sessão registrada há 7, 14 ou 30 dias, contando do cadastro quando não há sessões. Esse indicador não comprova inatividade física.
- Evolução mostra as últimas 40 cargas/medidas disponíveis e sessões em 8 semanas, incluindo a semana atual em andamento. A carga é o maior valor informado por sessão para o exercício selecionado. Pontos são consultáveis por teclado e têm tabela de valores.

## Lembretes: preparar antes de ativar

A integração está implementada, mas não foi publicada nem ativada no seu Supabase. Nenhum e-mail ou WhatsApp foi enviado nesta implementação. Para ativar, é necessário acesso ao painel do Supabase, um domínio de envio no Resend e/ou uma conta WhatsApp Business com um modelo aprovado na Meta. Não coloque chaves no `.env` do frontend e não cole segredos em chats.

1. Execute a migração 008.
2. Publique a Edge Function `send-reminders` usando a CLI do Supabase, ou copie os dois arquivos da pasta `supabase/functions/send-reminders` para a função no painel. Pela CLI, após autenticar e vincular seu projeto: `supabase functions deploy send-reminders`. O `config.toml` desativa a validação JWT desta função porque ela exige seu próprio segredo `x-evolva-cron-secret`.
3. Configure os Secrets descritos em `supabase/functions/.env.example`. `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são variáveis de servidor fornecidas pelo ambiente hospedado. Gere `EVOLVA_CRON_SECRET` longo e aleatório. Use um domínio HTTPS real em `EVOLVA_APP_URL`. Mantenha `EVOLVA_REMINDERS_ENABLED=false` enquanto prepara o serviço.
4. Para e-mail, configure `RESEND_API_KEY` e `EVOLVA_EMAIL_FROM` com remetente autorizado no Resend.
5. Para WhatsApp, configure token de servidor, ID do número, versão suportada da Graph API, nome do modelo e idioma. O modelo deve ter **duas variáveis de texto no corpo**, nesta ordem: descrição do lembrete e endereço do aplicativo. Exemplo de corpo para submeter à aprovação: “Lembrete do Evolva: {{1}}. Consulte seu acompanhamento: {{2}}. Você pode desativar estes avisos em Configurações.” Não é envio por uma conta pessoal do WhatsApp.
6. No Vault do Supabase, cadastre `evolva_project_url` e `evolva_cron_secret` conforme os comentários de `sql/009_agendar_lembretes.example.sql`. Ative pg_cron/pg_net e execute esse arquivo para processar a fila a cada cinco minutos. A chave deve coincidir com o Secret da função. Repetir o agendamento com o mesmo nome atualiza o job.
7. Com contas de homologação, o aluno aceita o convite e autoriza os canais em Configurações → Receber lembretes. O professor abre Lembretes e programa um aviso para um treino publicado ou atendimento futuro.
8. Quando os provedores estiverem prontos, altere `EVOLVA_REMINDERS_ENABLED=true`. Verifique a fila e a entrega no provedor. Esta ativação pode enviar os itens pendentes autorizados; revise a fila antes de habilitar.

Não é necessário configurar ambos os canais: os trabalhos de canais sem credenciais permanecem na fila. Há no máximo cinco itens por execução. Um mesmo treino/atendimento permite um lembrete por canal, sem reenvio automático. A configuração inicial não cria mensagens retroativas: o professor escolhe o que colocar na fila.

Atendimentos entram para envio uma hora antes; se programados com menos antecedência, entram imediatamente. Treinos entram imediatamente. O processamento respeita o horário atualizado da agenda e verifica novamente vínculo, publicação/cancelamento e autorização antes de obter cada lote. A autorização pode mudar após essa verificação, quando o envio já estiver em andamento.

“Aceito pelo provedor” não é confirmação de entrega ou leitura; não há webhook de recibos. Erros de rede ou respostas ambíguas ficam como “Envio sem confirmação” e não são repetidos automaticamente, evitando duplicar WhatsApp. Trabalhos em processamento por mais de dez minutos também recebem esse estado. E-mails usam chave de idempotência no Resend. Se precisar reenviar um item incerto, confira antes o histórico do provedor; não altere a fila sem essa revisão.

## Fontes oficiais da integração

- [Resend: envio de e-mail](https://resend.com/docs/api-reference/emails/send-email)
- [Resend: idempotência](https://resend.com/changelog/idempotency-keys)
- [Meta: modelos de mensagem](https://whatsappbusiness.com/blog/manage-message-templates-whatsapp-business-api/)
- [Supabase: agendar Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
- [Supabase: Secrets](https://supabase.com/docs/guides/functions/secrets)
