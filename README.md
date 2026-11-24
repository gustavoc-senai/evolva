# Evolva 1.0

## Novos recursos

Para habilitar a edição dos exercícios iniciais pelo professor, execute também `sql/010_edicao_exercicios.sql`. A edição atualiza os treinos e modelos do seu espaço e preserva o catálogo dos outros professores.

Vídeos privados por upload, modelos reutilizáveis de treino, calendário semanal/mensal, alertas de acompanhamento, gráficos de evolução e fila de lembretes por e-mail/WhatsApp. Para atualizar uma instalação existente, execute **`sql/008_recursos_avancados.sql`** no SQL Editor. Consulte [o guia de ativação](docs/RECURSOS_AVANCADOS.md), incluindo a configuração externa necessária para envio de lembretes.

Para conferir a configuração local e testar uma consulta pública ao banco, execute `npm run setup:check` após preencher o `.env`. O comando não altera dados nem mostra chaves. Ele não substitui a validação de autenticação, Storage e e-mails.

Aplicativo de acompanhamento para personal trainers com React, TypeScript e Supabase.

A versao atual nao cobra assinatura da plataforma nem limita a quantidade de alunos.

## Instalação — sem alterar código

1. Crie um projeto Supabase novo para o Evolva.
2. Abra o SQL Editor e execute **inteiro** `sql/INSTALAR_COMPLETO.sql`. As últimas linhas devem retornar `true` para todas as verificações.
Para atualizar uma instalacao existente e remover planos, execute tambem `sql/013_remover_planos.sql`.

3. Na pasta do projeto, copie `.env.example` para `.env` e preencha apenas:

```dotenv
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA
```

4. Execute:

```sh
npm install
npm run dev
```

Abra o endereço mostrado pelo Vite, normalmente `http://localhost:5173`.


## Autenticação

No Supabase, configure Authentication → URL Configuration com o endereço local/de produção e permita a rota `/atualizar-senha` nos Redirect URLs. A recuperação de senha usa o serviço de e-mail do Supabase, sujeito à configuração e aos limites do projeto.

Para cadastro SEM confirmação de e-mail, desative **Confirm email** no provedor de e-mail do Supabase. O frontend não consegue desligar essa opção remotamente. O sistema não possui senha compartilhada entre personal e aluno.

Cadastre sua conta, crie seu espaço de personal e comece a cadastrar os alunos. O aluno entra pelo link enviado pelo personal, usando o mesmo e-mail cadastrado.

## Módulos

- **Site:** apresentação do produto, entrada e cadastro.
- **Acesso:** autenticação, recuperação/alteração de senha, onboarding, convites por link, seleção entre acompanhamentos e revogação.
- **Personal:** dashboard com registros reais, alunos e objetivos, anotações internas, biblioteca de exercícios próprios e iniciais, filtros e exportações.
- **Treinos:** editor com ordem de exercícios, séries, repetições/duração, descanso, notas, rascunhos editáveis, publicação, duplicação e arquivamento.
- **Aluno:** treinos publicados, registro das séries realizadas, cargas, esforço percebido opcional, notas e cronômetro de descanso. Rascunho local de sessão e identificador de reenvio preservados no navegador.
- **Acompanhamento:** histórico de sessões e cargas, avaliações datadas e compartilhamento explícito, check-in diário e fotos privadas até 5 MB.
- **Agenda:** atendimentos, prevenção de sobreposição, confirmação do aluno e histórico de cancelamentos.
- **Mensagens:** conversas por aluno, autoria do servidor, reenvio idempotente e notificações internas.
- **Financeiro:** cobranças do personal para o aluno, recebimentos parciais, saldo, vencimento, cancelamento e estorno do registro. Sem captura automática de dinheiro.
- **Relatórios:** sessões/check-ins por aluno e recebimentos por período, com exportação CSV.
- **Segurança:** RLS em 19 tabelas, escritas por RPC, bucket privado, campos internos separados e auditoria sem copiar conteúdo sensível.

## Dados de demonstração — opcional

No `.env.server`, defina também `EVOLVA_DEMO_PASSWORD` com pelo menos 12 caracteres e execute:

```sh
npm run demo:seed
```

O comando cria contas separadas `personal.demo@evolva.example` e `aluno.demo@evolva.example`, um vínculo, treino e cobrança fictícios. A senha é a configurada localmente; não é impressa. Esses e-mails não recebem recuperação. Não substitui contas existentes com o mesmo e-mail que não tenham sido criadas pela carga demo. Repetir usa a senha original e não duplica a prescrição ou a cobrança. Não executado no seu Supabase por esta entrega.

## Desenvolvimento e deploy

```sh
npm run build
npm test
npm run preview
```

Para Vercel, o projeto já inclui `vercel.json`: comando `npm run build`, saída `dist` e as duas variáveis públicas do `.env`. Configure Site URL e Redirect URLs no Supabase para o domínio publicado. Convites usam o domínio onde você clicou em Copiar link; links copiados em localhost continuam locais.

Leia [docs/OPERACAO.md](docs/OPERACAO.md), [docs/BANCO.md](docs/BANCO.md), [docs/PRODUTO.md](docs/PRODUTO.md) e [VALIDACAO.md](VALIDACAO.md).
