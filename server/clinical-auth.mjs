import {createClient} from '@supabase/supabase-js';
import {HuliError} from '../supabase/functions/_shared/huli.mjs';
export async function authorizeClinic(req,config,makeClient=createClient){
 const header=req.headers.authorization||'';
 if(!/^Bearer [^\s]+$/.test(header))throw new HuliError('Inicia sesión con tu cuenta de Stratos.',401);
 if(!config.stratosOrganizationId || !config.stratosUserId || !config.authUrl || !config.authAnonKey)throw new HuliError('Tenant clínico sin configurar.',503);
 const db=makeClient(config.authUrl,config.authAnonKey,{global:{headers:{Authorization:header}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await db.auth.getUser(header.slice(7));
 if(error||!data.user)throw new HuliError('Tu sesión expiró. Inicia sesión de nuevo.',401);
 if(data.user.id!==config.stratosUserId)throw new HuliError('Esta cuenta no está autorizada para la clínica.',403);
 const profile=await db.from('profiles').select('id,organization_id,active').eq('id',data.user.id).single();
 if(profile.error || !profile.data?.active || profile.data.organization_id!==config.stratosOrganizationId)throw new HuliError('Tu cuenta no pertenece al tenant clínico activo.',403);
 const org=await db.from('organizations').select('id,active').eq('id',config.stratosOrganizationId).single();
 if(org.error||!org.data?.active)throw new HuliError('La organización clínica está inactiva.',403);
 return data.user.id;
}
