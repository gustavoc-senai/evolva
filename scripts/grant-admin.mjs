import { createClient } from '@supabase/supabase-js';
const {EVOLVA_SUPABASE_URL:url,EVOLVA_SERVICE_ROLE_KEY:key,EVOLVA_ADMIN_EMAIL:email}=process.env;
if(!url||!key||!email)throw Error('Configure .env.server conforme .env.server.example.');
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
let account;
for(let page=1;;page++){const {data,error}=await db.auth.admin.listUsers({page,perPage:100});if(error)throw Error(error.message);account=data.users.find(u=>u.email?.toLowerCase()===email.trim().toLowerCase());if(account||data.users.length<100)break;}
if(!account)throw Error('Cadastre a conta antes de conceder acesso administrativo.');
const {error}=await db.from('evolva_platform_admins').upsert({account_id:account.id});if(error)throw Error(error.message);
console.log('Admin da plataforma configurado. Entre novamente na conta para abrir /app/plataforma.');
