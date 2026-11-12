# Operação do Evolva

Os novos recursos (vídeos por upload, modelos, calendário, alertas, gráficos e lembretes externos opcionais) estão documentados em [RECURSOS_AVANCADOS.md](RECURSOS_AVANCADOS.md). Instalações anteriores precisam executar a migração 008.

## Primeira utilização

O personal cria a conta e o espaço. Não há dados fictícios no dashboard normal. Cadastre um aluno, gere o convite, copie o link e envie por seu canal habitual. O sistema não envia esse convite por e-mail automaticamente. Gerar outro convite revoga o anterior; a validade é 48 horas.

O aluno se cadastra com o e-mail convidado, aceita e acessa seu acompanhamento. Se também tiver outro personal, cada vínculo aparece no seletor de espaços. O personal continua dono dos próprios registros, mesmo após revogar o acesso da conta do aluno.

## Prescrição e registro

Adicione exercícios próprios ou use a biblioteca inicial de nomes. Os vídeos são links HTTPS informados pelo profissional; não há vídeos licenciados embutidos. Ao montar o treino, escolha o aluno e defina a prescrição. Rascunho é editável. Publicado preserva itens e registros; para alterar, duplique, ajuste e publique a nova versão. Arquivar tira da lista padrão do aluno e mantém a consulta histórica.

O aluno abre o treino, marca as séries realizadas e informa repetições/carga. Pode registrar parte da prescrição. Nenhum campo afirma comprovar movimento ou adesão. O timer funciona em tempo decorrido; não é uma ferramenta de diagnóstico. Alterar valores não altera a prescrição do personal.

A sessão em andamento fica no navegador por conta/treino. Ao enviar, um UUID evita duplicação em reenvios iguais, inclusive após recarregar a página se o armazenamento local estiver disponível. O envio bem-sucedido apaga o rascunho. Ao editar o conteúdo após um resultado incerto de rede, consulte o histórico antes de reenviar como uma nova operação.

## Avaliações, fotos e notas

Avaliações são registros datados, não sobrescrevem o anterior. Peso/altura/cintura/quadril são opcionais e não geram diagnósticos ou recomendações. O personal decide se a avaliação é compartilhada. Anotações internas ficam em tabela separada e não chegam ao aluno.

Fotos JPEG/PNG/WebP até 5 MB usam bucket privado. O vínculo do arquivo exige que pertença ao upload da própria conta e ao aluno autorizado. URLs assinadas são temporárias, com 15 minutos; a galeria as renova enquanto aberta. Revogar o acesso bloqueia novas assinaturas e leituras pela aplicação; URLs já emitidas podem continuar válidas até expirar.

Para remover, a aplicação apaga o arquivo pelo Storage API e depois remove o vínculo. Caso haja falha entre essas etapas, repita a remoção do vínculo. Upload com falha posterior de vínculo pode deixar um arquivo sem registro: mantenha uma rotina administrativa para revisar objetos não vinculados antes de removê-los. Não remova arquivos diretamente por SQL da tabela storage.objects; isso não apaga o conteúdo no serviço de arquivos.

## Agenda e conversas

Os horários são armazenados com fuso e exibidos no horário do navegador. Atendimentos do mesmo personal não podem se sobrepor quando agendados/confirmados; horários consecutivos são permitidos. Um aluno confirma somente o próprio atendimento. Notas do evento são compartilhadas com o aluno relacionado.

Conversas são por vínculo de aluno. Sem editar autoria. Atualização por consulta a cada 15 segundos e botão Atualizar; não é uma chamada em tempo real. As notificações internas avisam sobre novas mensagens e treinos publicados pelo editor. Não há notificações push, e-mail ou WhatsApp integradas.

## Financeiro

Cobrança representa um valor a receber. O personal registra pagamentos que de fato recebeu fora da plataforma. Pagamento parcial deixa saldo em aberto. Recebimento excessivo é rejeitado. Estorno corrige o registro interno, reabre saldo e registra motivo; não devolve dinheiro no banco. Cobrança com recebimento ativo não pode ser cancelada.

O aluno consulta suas cobranças e os recebimentos relacionados, mas não quita valores nem altera status. O financeiro deste acompanhamento é separado da assinatura que o personal paga para usar o Evolva.

## Assinatura do SaaS

São 14 dias de teste no Essencial e limites de alunos ativos por plano. O operador gerencia planos e validade manualmente. Não há checkout de cartão/Pix, webhook financeiro ou renovação automática. Solicitações do personal não ativam o plano por si mesmas.

Plano vencido/suspenso bloqueia novos cadastros/prescrições/avaliações/eventos/cobranças, sessões/check-ins/mensagens e uploads. Dados anteriores permanecem acessíveis conforme o vínculo e a RLS. Revogação de acesso, confirmação de um atendimento existente e correção/registro financeiro de cobrança existente continuam possíveis. Perfil e notas internas podem ser atualizados.

## Exportação e implantação

Exportações refletem as permissões da conta. As tabelas são carregadas em páginas de 500 para não truncar saldos no limite padrão do PostgREST. Telas históricas podem mostrar os primeiros 30/100 itens no render, mantendo os dados completos para cálculos/exportações onde oferecidas. Grandes bases exigirão aferição de desempenho e seleção remota mais específica.

O projeto não foi publicado nem conectado ao Supabase real do usuário. Faça o fluxo de homologação descrito em VALIDACAO.md antes de cadastrar dados de produção. Backup do banco e backup dos arquivos do Storage são operações diferentes; configure ambos na sua operação.
