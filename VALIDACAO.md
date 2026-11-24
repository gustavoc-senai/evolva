# Validação Evolva 1.0

## Correção da edição de exercícios

Build aprovado, 43 verificações locais de banco e 54 testes de interface/processamento passando. A migração 010 permite editar exercícios iniciais por espaço, atualiza referências nos treinos/modelos e preserva os registros de séries. Testes cobrem repetição sem duplicação, isolamento entre professores, bloqueio de aluno e resolução de exercícios personalizados inativos. A interface tem edição direta pelo editor de treinos e mensagem específica para migração ausente. A migração não foi aplicada ao Supabase do usuário nesta sessão.

## Atualização de recursos avançados

- Build TypeScript/Vite aprovado após as novas funcionalidades.
- 39 verificações PostgreSQL/PGlite, incluindo migração 008 repetível, isolamento dos modelos, vídeo privado com acesso por prescrição, autorização de lembretes, processamento exclusivo do servidor, cancelamento de consentimento/agenda e repetição do instalador completo preservando dados.
- 51 testes de interface e processamento, incluindo upload vinculado ao exercício, carregamento de URL temporária, criação/uso de modelos, calendário, alertas, gráficos consultáveis, fila e payloads de e-mail/WhatsApp com provedores simulados.
- Sintaxe do processador de lembretes verificada no Node. O wrapper Deno não foi executado no ambiente hospedado.
- Não realizados: aplicar a migração no Supabase do usuário, deploy da Edge Function, upload real, envio real e revisão visual em navegador. A consulta anônima à API não comprova instalação das tabelas quando o schema recusa o acesso.

As verificações da entrega original abaixo são preservadas como histórico. A chave administrativa que estava no arquivo de exemplo foi removida durante a configuração; se era válida, deve ser substituída no Supabase.

## Entrega original

- Build de produção TypeScript/Vite aprovado.
- 30 verificações PostgreSQL/PGlite: migrações repetíveis, dados separados entre profissionais, convites/e-mail/expiração/revogação, rascunho/publicação, exercício de outro espaço, sessão e séries idempotentes/atômicas, check-in próprio, notas privadas, avaliações compartilhadas, agenda/sobreposição, mensagens/notificações, pagamentos parciais/estorno/excesso, fotos vinculadas ao upload, editor/arquivo histórico, admin não autoatribuível, limites e suspensão.
- 21 testes React/jsdom: site, cadastro com validação, senha incorreta, convite/retorno, recuperação, cadastro de aluno, biblioteca global/privada, treino publicado no aluno, plataforma restrita, ações de cobrança por perfil, registro de séries, preservação após falha/reenvio e navegação segura, paginação sem truncar saldos, erros de páginas e recarga de dados.
- Scripts locais administrativos e demo com sintaxe verificada. Não executados em um Supabase real por falta de credenciais.
- Layout com regras de desktop/tablet/celular, diálogos com foco contido, navegação inferior no aluno e tabelas com rolagem.

Não executados: homologação no Supabase real, envio real de e-mail, upload no Storage real, navegador visual desktop/mobile, deploy ou cobrança externa. O ambiente de browser não possui encaminhamento para o servidor local; não foi feita revisão visual real. Antes de uso comercial, verifique os fluxos reais com contas separadas de personal e aluno, incluindo convite, publicação, sessão, arquivos, agenda e recuperação de senha.

O ZIP não contém chaves ou contas criadas no projeto do usuário. Não há métricas ou pagamentos fictícios no dashboard normal. Os dados demo são opcionais e identificados como demonstração.
