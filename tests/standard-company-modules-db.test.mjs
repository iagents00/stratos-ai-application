import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {PGlite}=await import(process.env.STRATOS_PGLITE_MODULE||'@electric-sql/pglite');
const id=n=>'20000000-0000-4000-8000-'+String(n).padStart(12,'0');
test('root and partner installations provision standard modules and financial permissions without modifying existing companies',async()=>{
 const db=new PGlite();const root=id(1),partner=id(2),parent=id(3),legacy=id(4),a=id(5),b=id(6),admin=id(7),advisor=id(8),otherAdmin=id(9);
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;
 create table organizations(id uuid primary key default gen_random_uuid(),name text,slug text unique,seats int,plan text,active boolean,subscription_status text,meta_config jsonb default '{}',parent_organization_id uuid);
 create table profiles(id uuid primary key,organization_id uuid references organizations(id),role text,active boolean);
 create table platform_admins(user_id uuid primary key,active boolean,scope_organization_id uuid,company_limit int);
 create table platform_admin_events(id uuid default gen_random_uuid(),event_type text,actor_user_id uuid,partner_organization_id uuid,organization_id uuid,payload jsonb,notification_status text);
 create table company_module_entitlements(organization_id uuid references organizations(id),module_key text,enabled boolean,changed_by uuid,primary key(organization_id,module_key));
 create table company_module_permissions(organization_id uuid references organizations(id),module_key text,principal_type text,principal_id text,capability text,decision text,changed_by uuid,primary key(organization_id,module_key,principal_type,principal_id,capability));
 create table appointment_calls(organization_id uuid,stage text);
 create function fn_company_appointment_config(p_org uuid,p_stage text) returns void language sql as $$insert into appointment_calls values(p_org,p_stage)$$;
 grant usage on schema public,auth to authenticated,anon,service_role;`);
 await db.exec(readFileSync('supabase/migrations/292_standard_company_modules.sql','utf8'));
 const policies=readFileSync('supabase/migrations/248_company_module_permissions.sql','utf8');
 for(const name of ['fn_company_module_allowed','fn_my_company_module_access']){const start=policies.indexOf('create or replace function public.'+name+'(');const end=policies.indexOf('end $$;',start)>=0&&name==='fn_my_company_module_access'?policies.indexOf('end $$;',start)+7:policies.indexOf('$$;',start)+3;await db.exec(policies.slice(start,end));}
 await db.query("insert into organizations(id,name,slug,active,meta_config) values($1,'Legacy','legacy',true,'{}'),($2,'Parent','parent',true,'{}')",[legacy,parent]);
 await db.query('insert into platform_admins values($1,true,null,null),($2,true,$3,1)',[root,partner,parent]);
 await db.exec("select set_config('request.jwt.claim.role','service_role',false)");
 for(const invalid of ['[]','1','true','"invalid"']) await assert.rejects(db.query('select fn_new_company_features($1::jsonb)',[invalid]),/Módulos/);
 const features={teamAdmin:true,mktModule:false,comandoDirectivo:false};
 const provision=(actor,org,name,p=features)=>db.query('select fn_provision_company($1,$2,$3,$4,5,$5::jsonb) result',[actor,org,name,name.toLowerCase(),JSON.stringify(p)]);
 await provision(root,a,'Alpha');await provision(partner,b,'Beta');
 const required=['comandoDirectivo','erp','finanzas','miDrive','landingPages'];
 for(const org of [a,b]){const meta=(await db.query('select meta_config from organizations where id=$1',[org])).rows[0].meta_config;for(const key of required)assert.equal(meta.features[key],true,key);assert.equal(meta.features.copilotModule,true);assert.equal(meta.features.procesoGuiado,false);assert.equal(meta.features.whatsappModule,false);assert.equal(meta.features.caja,true);}
 assert.equal((await db.query('select count(*)::int n from company_module_permissions')).rows[0].n,24);
 assert.equal((await db.query('select count(*)::int n from appointment_calls')).rows[0].n,2);
 assert.equal((await provision(partner,b,'Beta')).rows[0].result.replayed,true);assert.equal((await db.query('select count(*)::int n from company_module_permissions')).rows[0].n,24);
 await assert.rejects(provision(partner,id(10),'Third'),/cupo/);
 await assert.rejects(provision(root,id(10),'Third',{...features,arbitrary:true}),/Módulos/);
 assert.deepEqual((await db.query('select meta_config from organizations where id=$1',[legacy])).rows[0].meta_config,{});
 await db.query("insert into profiles values($1,$4,'admin',true),($2,$4,'asesor',true),($3,$5,'admin',true)",[admin,advisor,otherAdmin,a,b]);
 await db.exec(`create table team_expenses(id uuid primary key,organization_id uuid,persona_id uuid,created_by uuid,amount int);
 alter table team_expenses enable row level security;
 create policy own_finance on team_expenses for all to authenticated using (organization_id=(select organization_id from profiles where id=auth.uid()) and fn_company_module_allowed(organization_id,'caja','read_all')) with check(organization_id=(select organization_id from profiles where id=auth.uid()) and fn_company_module_allowed(organization_id,'caja','create'));
 grant select on profiles to authenticated;grant select,insert on team_expenses to authenticated;`);
 await db.query('insert into team_expenses values($1,$3,$5,$5,10),($2,$4,$6,$6,20)',[id(11),id(12),a,b,admin,otherAdmin]);
 await db.exec("select set_config('request.jwt.claim.role','authenticated',false)");await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);await db.exec('set role authenticated');
 assert.deepEqual((await db.query('select organization_id,amount from team_expenses')).rows,[{organization_id:a,amount:10}]);
 assert.equal((await db.query('select fn_my_company_module_access() result')).rows[0].result.caja.read_all,true);
 await assert.rejects(db.query('insert into team_expenses values($1,$2,$3,$3,1)',[id(13),b,admin]),/row-level security/);
 await assert.rejects(db.query('select fn_seed_company_finance($1,$2)',[a,root]),/permission denied/);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[advisor]);assert.equal((await db.query('select * from team_expenses')).rows.length,0);assert.equal((await db.query('select fn_my_company_module_access() result')).rows[0].result.caja.read_all,false);
 await db.exec('reset role');await db.exec("select set_config('request.jwt.claim.role','service_role',false)");
 await db.query("update company_module_permissions set decision='deny' where organization_id=$1 and principal_id='admin' and capability='read_all'",[a]);await db.query('update company_module_entitlements set enabled=false where organization_id=$1',[a]);await db.query('select fn_seed_company_finance($1,$2)',[a,root]);
 assert.equal((await db.query('select enabled from company_module_entitlements where organization_id=$1',[a])).rows[0].enabled,false);assert.equal((await db.query("select decision from company_module_permissions where organization_id=$1 and principal_id='admin' and capability='read_all'",[a])).rows[0].decision,'deny');
 }finally{await db.close();}
});
