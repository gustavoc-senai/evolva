import {createClient} from '@supabase/supabase-js';
import {createHash} from 'node:crypto';
const {EVOLVA_SUPABASE_URL:url,EVOLVA_SERVICE_ROLE_KEY:key,EVOLVA_DEMO_PASSWORD:password}=process.env;
if(!url||!key||!password||password.length<12)throw Error('Configure URL, chave administrativa e EVOLVA_DEMO_PASSWORD (12 caracteres ou mais) no .env.server.');
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(url,key,options),personal=createClient(url,key,options),student=createClient(url,key,options);
function checked(r){if(r.error)throw Error(r.error.message);return r.data;}
async function account(email,name){let user;for(let page=1;;page++){const data=checked(await admin.auth.admin.listUsers({page,perPage:100}));user=data.users.find(u=>u.email?.toLowerCase()===email);if(user||data.users.length<100)break;}if(user&&!user.user_metadata?.evolva_demo)throw Error('E-mail já pertence a outra conta; nada foi redefinido.');if(!user)user=checked(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{name,evolva_demo:true}})).user;return user;}
function uuid(value){const h=createHash('sha256').update(value).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;}
try{
 const trainerEmail='personal.demo@evolva.example',studentEmail='aluno.demo@evolva.example';const trainer=await account(trainerEmail,'Personal Demonstração');await account(studentEmail,'Aluno Demonstração');
 checked(await personal.auth.signInWithPassword({email:trainerEmail,password}));checked(await student.auth.signInWithPassword({email:studentEmail,password}));
 let workspace=checked(await personal.from('evolva_workspaces').select('*').eq('owner_id',trainer.id).maybeSingle());
 if(!workspace){const id=checked(await personal.rpc('evolva_create_workspace',{p_name:'Studio Evolva · Demonstração'}));workspace={id};}
 let pupil=checked(await personal.from('evolva_students').select('*').eq('workspace_id',workspace.id).eq('email',studentEmail).maybeSingle());
 if(!pupil){const id=checked(await personal.rpc('evolva_save_student',{p_workspace:workspace.id,p_student:null,p_name:'Aluno Demonstração',p_email:studentEmail,p_phone:null,p_goal:'Dados fictícios para explorar o sistema.',p_active:true}));pupil={id};}
 if(!pupil.account_id){const token=checked(await personal.rpc('evolva_invite_student',{p_student:pupil.id}));checked(await student.rpc('evolva_accept_invitation',{p_token:token}));}
 const catalog=checked(await personal.from('evolva_exercises').select('*').is('workspace_id',null).order('name').limit(3));
 const request=uuid('evolva-demo-workout:'+workspace.id);
 const workout=checked(await personal.rpc('evolva_save_workout',{p_student:pupil.id,p_workout:null,p_title:'Treino demonstrativo',p_notes:'Exemplo de interface. Não é uma prescrição para uso real; defina o treino após avaliar seu aluno.',p_items:catalog.map(e=>({exercise_id:e.id,sets:1,repetitions:'Exemplo — definir pelo personal',rest_seconds:0,notes:'Registro fictício para demonstração.'})),p_publish:true,p_request:request}));
 checked(await personal.rpc('evolva_add_charge',{p_student:pupil.id,p_description:'Cobrança fictícia de demonstração',p_amount:100,p_due:new Date().toISOString().slice(0,10),p_request:uuid('evolva-demo-charge:'+workspace.id)}));
 console.log('Demonstração preparada.');console.log(`Personal: ${trainerEmail}\nAluno: ${studentEmail}\nSenha: a definida em EVOLVA_DEMO_PASSWORD.\nTreino: ${workout}`);
}catch(error){console.error('Não foi possível concluir:',error.message);console.error('Etapas anteriores podem ter sido salvas. Corrija o problema e repita com a mesma senha.');process.exitCode=1;}finally{await Promise.allSettled([personal.auth.signOut(),student.auth.signOut()]);}
