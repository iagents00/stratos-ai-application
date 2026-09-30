#!/usr/bin/env node
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID,randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

// Explicit input and administrative credentials; never fall back to another tenant.
const inputPath=process.argv.find(x=>x.startsWith('--input='))?.slice(8);
if(!inputPath)throw new Error('Indica --input=/ruta/privada/clinica.local. Usa --apply sólo para ejecutar el alta.');
const input=JSON.parse(readFileSync(inputPath,'utf8'));
if(!input.name?.trim() || !input.adminName?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.adminEmail||''))throw new Error('Falta nombre de clínica, nombre de administrador o correo válido.');
if(input.slug!=='clinica-dental')throw new Error('Este alta corresponde exclusivamente al cliente clinica-dental.');
if(input.password!==undefined && (typeof input.password!=='string' || input.password.length<12 || input.password.length>256))throw new Error('La contraseña indicada debe tener entre 12 y 256 caracteres.');
if(!input.organizationId){input.organizationId=randomUUID();writeFileSync(inputPath,JSON.stringify(input,null,2),{mode:0o600});}
if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.organizationId))throw new Error('UUID de nueva organización inválido.');
const expectedHost='glulgyhkrqpykxmujodb.supabase.co';
const url=process.env.STRATOS_SUPABASE_URL;
if(!url || new URL(url).hostname!==expectedHost)throw new Error('STRATOS_SUPABASE_URL debe apuntar al proyecto verificado de Stratos.');
if(!process.argv.includes('--apply')){console.log({validated:true,clientId:input.slug,organizationId:input.organizationId,mode:'dry-run',required:'STRATOS_SUPABASE_SERVICE_ROLE_KEY y tabla huli_access desplegada'});process.exit(0);}
const key=process.env.STRATOS_SUPABASE_SERVICE_ROLE_KEY;
if(!key)throw new Error('Falta la credencial administrativa privada del proyecto Stratos.');
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const fail=(error,message)=>{if(error)throw new Error(message);};
// Preflight all permissions and conflicts before any mutation.
const access=await db.from('huli_access').select('organization_id').limit(0);fail(access.error,'Primero despliega la migración huli_access.');
const existing=await db.from('organizations').select('id,slug,name').or(`id.eq.${input.organizationId},slug.eq.${input.slug}`);fail(existing.error,'No se puede verificar la organización.');
if(existing.data.some(o=>o.id!==input.organizationId || o.slug!==input.slug))throw new Error('El slug pertenece a otra organización. No se modificó.');
let page=1,admin;
while(true){const users=await db.auth.admin.listUsers({page,perPage:1000});fail(users.error,'No se pueden verificar usuarios existentes.');admin=users.data.users.find(u=>u.email?.toLowerCase()===input.adminEmail.toLowerCase());if(admin || users.data.users.length<1000)break;page++;}
if(admin){const profile=await db.from('profiles').select('organization_id').eq('id',admin.id).single();fail(profile.error,'El administrador existente no tiene perfil verificable.');if(profile.data.organization_id!==input.organizationId)throw new Error('Ese correo pertenece a otro tenant. No se moverá al nuevo.');}
if(!existing.data.length){const org=await db.from('organizations').insert({id:input.organizationId,name:input.name.trim(),slug:input.slug,plan:'pro',seats:5,active:true,subscription_status:'trial',primary_color:'#0D9A76'});fail(org.error,'No se pudo crear la organización.');}
if(!admin){
 const password=input.password || randomBytes(24).toString('base64url');
 // Store recovery material before the request, so an uncertain network result can be recovered.
 const privatePath=inputPath+'.access.local';writeFileSync(privatePath,JSON.stringify({email:input.adminEmail,password,organizationId:input.organizationId},null,2),{mode:0o600});
 const created=await db.auth.admin.createUser({email:input.adminEmail,password,email_confirm:true,user_metadata:{name:input.adminName,organization_id:input.organizationId,organization_name:input.name,organization_slug:input.slug,client_id:input.slug,role:'admin'}});fail(created.error,'No se pudo crear el administrador. La organización puede haber quedado creada; vuelve a ejecutar para recuperar el alta.');admin=created.data.user;
}
const profile=await db.from('profiles').update({organization_id:input.organizationId,name:input.adminName,role:'admin',active:true}).eq('id',admin.id).select('id,organization_id').single();fail(profile.error,'No se pudo verificar el perfil del administrador.');
if(profile.data.organization_id!==input.organizationId)throw new Error('No coincide la organización del administrador.');
const enabled=await db.from('huli_access').upsert({organization_id:input.organizationId,user_id:admin.id,enabled:true},{onConflict:'organization_id,user_id'});fail(enabled.error,'No se pudo habilitar el acceso Huli.');
console.log({provisioned:true,clientId:input.slug,organizationId:input.organizationId,adminId:admin.id,next:'Configurar este UUID en el cliente y HULI_CONNECTIONS_JSON; desplegar huli-copilot y autenticar con Supabase.'});
