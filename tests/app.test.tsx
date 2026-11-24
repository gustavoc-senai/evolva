import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {MemoryRouter,Routes,Route,useLocation} from 'react-router-dom';
import {Landing,AuthPage,InvitationPage,PasswordPage} from '../src/pages/Public';
import Students from '../src/pages/Students';
import Workouts, { WorkoutBuilder } from '../src/pages/Workouts';
import Templates from '../src/pages/Templates';
import Exercises from '../src/pages/Exercises';
import Session from '../src/pages/Session';
import {Platform} from '../src/pages/Plans';
import Finance from '../src/pages/Finance';
import Agenda from '../src/pages/Agenda';
import Notifications from '../src/pages/Notifications';
import WeeklySchedule from '../src/pages/WeeklySchedule';
import SetupStatus from '../src/components/SetupStatus';
import {safeNext,videoUrl} from '../src/lib/utils';
const mock=vi.hoisted(()=>({user:null as any,recovery:false,access:{workspace:{id:'w',name:'Personal teste',owner_id:'trainer'},role:'TRAINER',studentId:'s',studentName:'Aluno'}as any,isAdmin:false,rows:{}as Record<string,any[]>,rpc:vi.fn(),signup:vi.fn(),login:vi.fn(),reset:vi.fn(),update:vi.fn(),signout:vi.fn(),reload:vi.fn()}));
vi.mock('../src/contexts/Auth',()=>({useAuth:()=>({user:mock.user,loading:false,recovery:mock.recovery,clearRecovery:vi.fn()})}));
vi.mock('../src/contexts/Workspace',()=>({useWorkspace:()=>({access:mock.access,accesses:mock.access?[mock.access]:[],isAdmin:mock.isAdmin,reload:mock.reload,loading:false,error:''})}));
vi.mock('../src/lib/hooks',()=>({useRows:(table:string)=>({rows:mock.rows[table]??[],loading:false,error:''})}));
const storageMock=vi.hoisted(()=>({upload:vi.fn().mockResolvedValue({error:null}),remove:vi.fn().mockResolvedValue({error:null})}));
vi.mock('../src/lib/supabase',()=>({configured:true,rpc:mock.rpc,supabase:{auth:{signUp:mock.signup,signInWithPassword:mock.login,resetPasswordForEmail:mock.reset,updateUser:mock.update,signOut:mock.signout},storage:{from:()=>({...storageMock,createSignedUrl:vi.fn().mockResolvedValue({data:{signedUrl:'https://example.com/photo.jpg'}})})}}}));
function mount(node:React.ReactNode,path='/'){return render(<MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>);}
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();mock.user=null;mock.access={workspace:{id:'w',name:'Personal teste',owner_id:'trainer'},role:'TRAINER',studentId:'s',studentName:'Aluno'};mock.isAdmin=false;mock.rows={};mock.rpc.mockResolvedValue('saved-id');mock.signup.mockResolvedValue({data:{session:{}},error:null});mock.login.mockResolvedValue({data:{session:{}},error:null});mock.reset.mockResolvedValue({error:null});mock.update.mockResolvedValue({error:null});vi.spyOn(window,'confirm').mockReturnValue(true);});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function fill(label:string,text:string){fireEvent.change(screen.getByLabelText(label),{target:{value:text}});}
describe('Entrada e convites',()=>{
 it('apresenta o produto com acesso a cadastro e login',()=>{mount(<Landing/>);expect(screen.getAllByRole('link',{name:/Começar|Criar meu espaço/}).every(a=>a.getAttribute('href')==='/cadastro')).toBe(true);expect(screen.getByRole('link',{name:'Entrar'}).getAttribute('href')).toBe('/login');});
 it('bloqueia cadastro com confirmação diferente',async()=>{mount(<AuthPage register/>);fill('Seu e-mail','personal@example.com');fill('Senha','segura123');fill('Confirmar senha','outra123');fireEvent.click(screen.getByRole('button',{name:'Criar conta'}));await screen.findByRole('alert');expect(mock.signup).not.toHaveBeenCalled();});
 it('exige oito caracteres antes de chamar cadastro',async()=>{mount(<AuthPage register/>);fill('Seu e-mail','personal@example.com');fill('Senha','curta');fill('Confirmar senha','curta');fireEvent.click(screen.getByRole('button',{name:'Criar conta'}));expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('8 caracteres'));expect(mock.signup).not.toHaveBeenCalled();});
 it('informa credenciais inválidas sem inventar sessão',async()=>{mock.login.mockResolvedValue({data:{session:null},error:{code:'invalid_credentials'}});mount(<AuthPage/>);fill('Seu e-mail','aluno@example.com');fill('Senha','senhaerrada');fireEvent.click(screen.getByRole('button',{name:'Entrar no meu espaço'}));await screen.findByText('E-mail ou senha incorretos.');});
 it('preserva o destino de convite no link de cadastro',()=>{mount(<AuthPage/>,'/login?next=%2Fconvite%2Faaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');expect(screen.getByRole('link',{name:'Criar conta'}).getAttribute('href')).toContain('?next=%2Fconvite%2F');});
 it('convite pede login sem tentar aceitar anonimamente',()=>{mount(<Routes><Route path="/convite/:token" element={<InvitationPage/>}/></Routes>,'/convite/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');expect(screen.getByRole('link',{name:'Entrar'}).getAttribute('href')).toContain('next=');expect(mock.rpc).not.toHaveBeenCalled();});
 it('recuperação usa o domínio atual e a rota correta',async()=>{mount(<PasswordPage/>);fill('E-mail','aluno@example.com');fireEvent.click(screen.getByRole('button',{name:'Enviar link'}));await waitFor(()=>expect(mock.reset).toHaveBeenCalledWith('aluno@example.com',{redirectTo:'http://localhost:5173/atualizar-senha'}));});
});
describe('Acompanhamento do personal',()=>{
 it('restaura os campos e exercícios do rascunho local após remontar o editor',()=>{
   mock.rows.evolva_students=[{id:'s',name:'Maria',active:true}];mock.rows.evolva_exercises=[{id:'e',workspace_id:'w',name:'Remada',muscle_group:'Costas',equipment:'Polia',active:true}];
   const first=mount(<WorkoutBuilder/>);fill('Aluno','s');fill('Nome do treino','Treino preservado');fill('Orientações gerais para o aluno','Minha orientação');fill('Escolher exercício','e');fireEvent.click(screen.getByRole('button',{name:'Adicionar ao treino'}));fill('Repetições / duração','12');
   first.unmount();mount(<WorkoutBuilder/>);expect(screen.getByLabelText('Nome do treino')).toHaveProperty('value','Treino preservado');expect(screen.getByLabelText('Orientações gerais para o aluno')).toHaveProperty('value','Minha orientação');expect(screen.getByLabelText('Repetições / duração')).toHaveProperty('value','12');
 });
 it('editar exercício dentro do treino preserva a prescrição em andamento',async()=>{
   mock.rows.evolva_exercises=[{id:'e',workspace_id:'w',name:'Remada',muscle_group:'Costas',equipment:'Polia',active:true}];
   mount(<WorkoutBuilder/>);fill('Nome do treino','Meu treino');fill('Escolher exercício','e');fireEvent.click(screen.getByRole('button',{name:'Editar exercício e vídeo'}));
   expect(screen.getByRole('dialog')).toBeTruthy();fill('Link de vídeo (HTTPS)','https://example.com/a.mp4');fireEvent.click(screen.getByRole('button',{name:'Salvar'}));
   await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect(screen.getByLabelText('Nome do treino')).toHaveProperty('value','Meu treino');expect(mock.rpc).toHaveBeenCalledWith('evolva_save_exercise',expect.objectContaining({p_exercise:'e',p_video:'https://example.com/a.mp4'}));
 });
 it('descarta somente as alterações locais após confirmação',()=>{
   mount(<WorkoutBuilder/>);fill('Nome do treino','Alteração local');fireEvent.click(screen.getByRole('button',{name:'Descartar alterações locais'}));expect(screen.getByLabelText('Nome do treino')).toHaveProperty('value','');expect(mock.rpc).not.toHaveBeenCalled();
 });
 it('não recupera rascunho de outra conta',()=>{
   mock.user={id:'trainer-a'};const first=mount(<WorkoutBuilder/>);fill('Nome do treino','Privado');first.unmount();mock.user={id:'trainer-b'};mount(<WorkoutBuilder/>);expect(screen.getByLabelText('Nome do treino')).toHaveProperty('value','');
 });
 it('programa rotina somente com treinos publicados do aluno',async()=>{
   mock.rows.evolva_students=[{id:'s',name:'Maria',active:true}];mock.rows.evolva_workouts=[{id:'published',student_id:'s',title:'Treino publicado',status:'PUBLISHED'},{id:'draft',student_id:'s',title:'Treino rascunho',status:'DRAFT'}];
   mount(<WeeklySchedule/>);fireEvent.click(screen.getAllByRole('button',{name:'Definir treino'})[0]);expect(screen.queryByRole('option',{name:'Treino rascunho'})).toBeNull();fill('Treino deste dia','published');fireEvent.click(screen.getByRole('button',{name:'Salvar'}));await waitFor(()=>expect(mock.rpc).toHaveBeenCalledWith('evolva_save_weekly_schedule',{p_student:'s',p_weekday:1,p_workout:'published'}));
 });
 it('aluno consulta rotina sem receber ações de edição',()=>{
   mock.access.role='STUDENT';mock.rows.evolva_weekly_schedule=[{id:'day',weekday:1,workout_id:'w'}];mock.rows.evolva_workouts=[{id:'w',title:'Treino da segunda',status:'PUBLISHED'}];mount(<WeeklySchedule/>);expect(screen.getByRole('link',{name:'Ver treino'}).getAttribute('href')).toBe('/app/treinos/w');expect(screen.queryByRole('button',{name:'Alterar dia'})).toBeNull();expect(screen.queryByLabelText('Aluno da rotina')).toBeNull();
 });
 it('diagnóstico identifica atualização ausente sem modificar o banco',async()=>{
   mock.rpc.mockResolvedValueOnce([{label:'Edição dos exercícios iniciais',migration:'010_edicao_exercicios.sql',ready:false}]);mount(<SetupStatus/>);fireEvent.click(screen.getByRole('button',{name:'Verificar configuração'}));expect(await screen.findByText(/Pendente: execute sql\/010/)).toBeTruthy();expect(mock.rpc).toHaveBeenCalledWith('evolva_setup_status');
 });
 it('abre exercício para edição pelo atalho do editor de treinos',async()=>{
   mock.rows.evolva_exercises=[{id:'e',workspace_id:null,name:'Remada',muscle_group:'Costas',equipment:'Polia',active:true}];
   mount(<Exercises/>,'/app/exercicios?editar=e');expect(await screen.findByRole('dialog')).toBeTruthy();expect(screen.getByLabelText('Nome do exercício')).toHaveProperty('value','Remada');
 });
 it('mostra apenas a versão personalizada na biblioteca do professor',()=>{
   mock.rows.evolva_exercises=[{id:'global',workspace_id:null,name:'Original',muscle_group:'Costas',equipment:'Polia',active:true},{id:'own',workspace_id:'w',source_exercise_id:'global',name:'Minha versão',muscle_group:'Costas',equipment:'Polia',active:true}];
   mount(<Exercises/>);expect(screen.queryByText('Original')).toBeNull();expect(screen.getByText('Minha versão')).toBeTruthy();
 });
 it('informa qual atualização falta quando o banco não tem edição dos iniciais',async()=>{
   mock.rows.evolva_exercises=[{id:'global',workspace_id:null,name:'Remada',muscle_group:'Costas',equipment:'Polia',active:true}];mock.rpc.mockRejectedValueOnce({code:'PGRST202'});
   mount(<Exercises/>);fireEvent.click(screen.getByRole('button',{name:'Editar'}));fireEvent.click(screen.getByRole('button',{name:'Salvar'}));expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('010_edicao_exercicios.sql'));
 });
 it('envia arquivo privado e vincula ao exercício do professor',async()=>{
   storageMock.upload.mockResolvedValue({error:null});storageMock.remove.mockResolvedValue({error:null});
   mock.rows.evolva_exercises=[{id:'own',workspace_id:'w',name:'Remada',muscle_group:'Costas',equipment:'Polia',active:true}];
   mount(<Exercises/>);fireEvent.click(screen.getByRole('button',{name:'Editar'}));
   fireEvent.change(screen.getByLabelText('Enviar vídeo do exercício (até 50 MB)'),{target:{files:[new File(['video'],'remada.mp4',{type:'video/mp4'})]}});
   fireEvent.click(screen.getByRole('button',{name:'Salvar'}));
   await waitFor(()=>expect(mock.rpc).toHaveBeenCalledWith('evolva_attach_video',{p_exercise:'own',p_path:expect.stringMatching(/^w\/.+\.mp4$/)}));
   expect(storageMock.upload).toHaveBeenCalled();
 });
 it('salva um modelo a partir de uma prescrição',async()=>{
   mock.rows.evolva_workouts=[{id:'workout',student_id:'s',title:'Treino A',status:'PUBLISHED',created_at:'2026-11-12'}];
   mount(<Workouts/>);fireEvent.click(screen.getByRole('button',{name:'Salvar como modelo'}));fill('Nome do modelo','Superiores');fireEvent.click(screen.getByRole('button',{name:'Salvar modelo'}));
   await waitFor(()=>expect(mock.rpc).toHaveBeenCalledWith('evolva_create_template',{p_workout:'workout',p_title:'Superiores'}));
 });
 it('modelos abrem editor para escolher um novo aluno sem copiar vínculo anterior',()=>{
   mock.rows.evolva_templates=[{id:'template',title:'Modelo A',items:[],created_at:'2026-11-12'}];
   mount(<Templates/>);expect(screen.getByRole('link',{name:'Usar modelo'}).getAttribute('href')).toBe('/app/treinos/novo?modelo=template');
 });
 it('carrega itens de modelo e exige aluno antes de criar prescrição',()=>{
   mock.rows.evolva_templates=[{id:'template',title:'Modelo A',notes:'Orientações',items:[{exercise_id:'e',sets:3,repetitions:'10',rest_seconds:60,notes:''}]}];
   mock.rows.evolva_students=[{id:'s',name:'Maria',active:true}];mock.rows.evolva_exercises=[{id:'e',name:'Remada',active:true,workspace_id:null}];
   mount(<WorkoutBuilder/>,'/app/treinos/novo?modelo=template');
   expect(screen.getByLabelText('Nome do treino')).toHaveProperty('value','Modelo A');expect(screen.getByLabelText('Aluno')).toHaveProperty('value','');expect(screen.getByLabelText('Séries')).toHaveProperty('value','3');
 });
 it('rejeita atendimento que termina antes de começar sem gravar no banco',async()=>{
   mount(<Agenda/>);fireEvent.click(screen.getByRole('button',{name:'Novo atendimento'}));
   fill('Nome do atendimento','Aula teste');fill('Início','2026-11-15T10:00');fill('Fim','2026-11-15T09:00');
   fireEvent.click(screen.getByRole('button',{name:'Salvar'}));
   expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('posterior ao início'));
   expect(mock.rpc).not.toHaveBeenCalled();
 });
 it('busca atendimentos pelo nome do aluno e permite recuperar a lista',()=>{
   mock.rows.evolva_students=[{id:'s',name:'Maria',active:true}];
   mock.rows.evolva_events=[{id:'a',student_id:'s',title:'Aula individual',starts_at:'2099-01-01T12:00:00Z',ends_at:'2099-01-01T13:00:00Z',status:'SCHEDULED'},{id:'b',title:'Organizar studio',starts_at:'2099-01-02T12:00:00Z',ends_at:'2099-01-02T13:00:00Z',status:'SCHEDULED'}];
   mount(<Agenda/>);fill('Buscar atendimento','Maria');expect(screen.getByText('Aula individual')).toBeTruthy();expect(screen.queryByText('Organizar studio')).toBeNull();
   fireEvent.click(screen.getByRole('button',{name:'Limpar filtros'}));expect(screen.getByText('Organizar studio')).toBeTruthy();
 });
 it('marca somente as notificações pendentes e permite filtrar não lidas',async()=>{
   mock.rows.evolva_notifications=[{id:'a',title:'Novo treino',body:'Treino disponível',created_at:'2026-11-12T12:00:00Z',read_at:null},{id:'b',title:'Aviso antigo',created_at:'2026-11-11T12:00:00Z',read_at:'2026-11-11T13:00:00Z'}];
   mount(<Notifications/>);fireEvent.click(screen.getByRole('button',{name:'Não lidas (1)'}));
   expect(screen.queryByText('Aviso antigo')).toBeNull();
   fireEvent.click(screen.getByRole('button',{name:'Marcar todas como lidas'}));
   await waitFor(()=>expect(mock.rpc).toHaveBeenCalledWith('evolva_read_notification',{p_notification:'a'}));
   expect(mock.rpc).toHaveBeenCalledTimes(1);expect(await screen.findByText('Notificação marcada como lida.')).toBeTruthy();
 });
 it('informa erro de leitura sem apresentar sucesso',async()=>{
   mock.rows.evolva_notifications=[{id:'a',title:'Novo treino',created_at:'2026-11-12T12:00:00Z',read_at:null}];mock.rpc.mockRejectedValueOnce({message:'Falha de conexão'});
   mount(<Notifications/>);fireEvent.click(screen.getByRole('button',{name:'Marcar como lida'}));
   expect(await screen.findByRole('alert')).toHaveProperty('textContent','Falha de conexão');
   expect(screen.queryByText('Notificação marcada como lida.')).toBeNull();
 });
 it('salva alterações e link de vídeo no exercício próprio',async()=>{
   mock.rows.evolva_exercises=[{id:'own',workspace_id:'w',name:'Remada',muscle_group:'Costas',equipment:'Polia',active:true}];
   mount(<Exercises/>);fireEvent.click(screen.getByRole('button',{name:'Editar'}));
   fill('Nome do exercício','Remada sentada');fill('Link de vídeo (HTTPS)','https://example.com/remada.mp4');
   expect(screen.getByLabelText('Demonstração de Remada')).toBeTruthy();
   fireEvent.click(screen.getByRole('button',{name:'Salvar'}));
   await waitFor(()=>expect(mock.rpc).toHaveBeenCalledWith('evolva_save_exercise',expect.objectContaining({p_exercise:'own',p_name:'Remada sentada',p_video:'https://example.com/remada.mp4',p_active:true})));
   expect(await screen.findByText(/Exercício atualizado/)).toBeTruthy();
 });
 it('personaliza exercício inicial criando cópia no espaço do professor',async()=>{
   mock.rows.evolva_exercises=[{id:'global',workspace_id:null,name:'Remada',muscle_group:'Costas',equipment:'Polia',active:true}];
   mount(<Exercises/>);fireEvent.click(screen.getByRole('button',{name:'Editar'}));
   fill('Link de vídeo (HTTPS)','https://example.com/a.mp4');fireEvent.click(screen.getByRole('button',{name:'Salvar'}));
   await waitFor(()=>expect(mock.rpc).toHaveBeenCalledWith('evolva_customize_exercise',expect.objectContaining({p_workspace:'w',p_source:'global',p_name:'Remada',p_video:'https://example.com/a.mp4'})));
 });
 it('combina busca sem acento com filtro de vídeo e permite limpar',()=>{
   mock.rows.evolva_exercises=[{id:'a',workspace_id:'w',name:'Elevação lateral',muscle_group:'Ombros',equipment:'Halteres',active:true,video_url:'https://example.com/a.mp4'},{id:'b',workspace_id:null,name:'Remada',muscle_group:'Costas',equipment:'Polia',active:true}];
   mount(<Exercises/>);fill('Buscar exercício','elevacao');fill('Vídeo de demonstração','with');
   expect(screen.getByText('Elevação lateral')).toBeTruthy();expect(screen.queryByText('Remada')).toBeNull();
   fireEvent.click(screen.getByRole('button',{name:'Limpar filtros'}));expect(screen.getByText('Remada')).toBeTruthy();
 });
 it('novo aluno envia dados para a RPC com espaço atual',async()=>{mount(<Students/>);fireEvent.click(screen.getByRole('button',{name:'Novo aluno'}));fill('Nome completo','Aluno teste');fill('E-mail de acesso','aluno@example.com');fireEvent.click(screen.getByRole('button',{name:'Cadastrar aluno'}));await waitFor(()=>expect(mock.rpc).toHaveBeenCalledWith('evolva_save_student',expect.objectContaining({p_workspace:'w',p_student:null,p_name:'Aluno teste',p_email:'aluno@example.com',p_active:true})));});
 it('professor pode editar um exercício da biblioteca inicial',()=>{mock.rows.evolva_exercises=[{id:'e',workspace_id:null,name:'Remada baixa',muscle_group:'Costas',equipment:'Polia',active:true}];mount(<Exercises/>);fireEvent.click(screen.getByRole('button',{name:'Editar'}));expect(screen.getByRole('dialog')).toBeTruthy();expect(screen.getByLabelText('Nome do exercício')).toHaveProperty('value','Remada baixa');});
 it('personal consegue editar exercício próprio',()=>{mock.rows.evolva_exercises=[{id:'e',workspace_id:'w',name:'Exercício próprio',muscle_group:'Costas',equipment:'Polia',active:true}];mount(<Exercises/>);fireEvent.click(screen.getByRole('button',{name:'Editar'}));expect(screen.getByRole('dialog')).toBeTruthy();expect((screen.getByLabelText('Nome do exercício')as HTMLInputElement).value).toBe('Exercício próprio');});
 it('aluno recebe apenas lista publicada por padrão',()=>{mock.access.role='STUDENT';mock.rows.evolva_workouts=[{id:'draft',title:'Rascunho privado',status:'DRAFT',student_id:'s',created_at:'2026-11-10'},{id:'published',title:'Treino A',status:'PUBLISHED',student_id:'s',created_at:'2026-11-10'}];mount(<Workouts/>);expect(screen.getByText('Treino A')).toBeTruthy();expect(screen.queryByText('Rascunho privado')).toBeNull();expect(screen.queryByRole('link',{name:/Nova prescrição/})).toBeNull();});
 it('usuário comum não carrega a administração da plataforma',()=>{mount(<Platform/>);expect(screen.getByText('Acesso restrito à administração da plataforma')).toBeTruthy();expect(mock.rpc).not.toHaveBeenCalled();});
 it('aluno não recebe ações administrativas de cobrança',()=>{mock.access.role='STUDENT';mount(<Finance/>);expect(screen.queryByRole('button',{name:'Nova cobrança'})).toBeNull();expect(screen.getByText(/Esta área não faz cobranças automáticas/)).toBeTruthy();});
});
describe('Registro de sessão e segurança de navegação',()=>{
 function setupSession(){mock.user={id:'student'};mock.access.role='STUDENT';mock.rows={evolva_workouts:[{id:'workout',title:'Treino A',status:'PUBLISHED'}],evolva_workout_items:[{id:'item',workout_id:'workout',exercise_id:'exercise',position:1,sets:1,repetitions:'10',rest_seconds:60}],evolva_exercises:[{id:'exercise',name:'Remada baixa'}]};mount(<Routes><Route path="/app/treinos/:id/executar" element={<Session/>}/><Route path="/app/evolucao" element={<p>Histórico</p>}/></Routes>,'/app/treinos/workout/executar');}
 it('sessão sem série marcada não chama o banco',async()=>{setupSession();fireEvent.click(screen.getByRole('button',{name:'Enviar registro'}));await screen.findByText('Marque ao menos uma série realizada.');expect(mock.rpc).not.toHaveBeenCalled();});
 it('série marcada exige repetições preenchidas',async()=>{setupSession();fireEvent.click(screen.getByRole('checkbox',{name:'Marcar exercício 1 série 1'}));fireEvent.click(screen.getByRole('button',{name:'Enviar registro'}));await screen.findByText('Informe as repetições das séries realizadas.');expect(mock.rpc).not.toHaveBeenCalled();});
 it('envia somente séries realizadas e preserva dados ao falhar',async()=>{setupSession();mock.rpc.mockRejectedValue({message:'Sem conexão'});fill('Repetições exercício 1 série 1','10');fill('Carga exercício 1 série 1','20');fireEvent.click(screen.getByRole('checkbox',{name:'Marcar exercício 1 série 1'}));fireEvent.click(screen.getByRole('button',{name:'Enviar registro'}));await screen.findByText('Sem conexão');expect(mock.rpc).toHaveBeenCalledWith('evolva_complete_session',expect.objectContaining({p_workout:'workout',p_sets:[{item_id:'item',set_number:1,repetitions:10,load_kg:20}]}));expect(localStorage.getItem('evolva-session:student:workout')).toContain('20');});
 it('volta ao mesmo identificador ao repetir registro após falha',async()=>{setupSession();mock.rpc.mockRejectedValue({message:'Sem conexão'});fill('Repetições exercício 1 série 1','10');fireEvent.click(screen.getByRole('checkbox',{name:'Marcar exercício 1 série 1'}));fireEvent.click(screen.getByRole('button',{name:'Enviar registro'}));await screen.findByText('Sem conexão');const first=mock.rpc.mock.calls[0][1].p_request;fireEvent.click(screen.getByRole('button',{name:'Enviar registro'}));await waitFor(()=>expect(mock.rpc).toHaveBeenCalledTimes(2));expect(mock.rpc.mock.calls[1][1].p_request).toBe(first);});
 it('bloqueia retorno externo e URLs de vídeo inseguras',()=>{expect(safeNext('/convite/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toContain('/convite/');for(const next of ['https://evil.test','//evil.test','/\\evil.test','javascript:alert(1)'])expect(safeNext(next)).toBe('/app');expect(videoUrl('javascript:alert(1)')).toBeNull();expect(videoUrl('http://example.com')).toBeNull();expect(videoUrl('https://example.com/video')).toBe('https://example.com/video');});
});
