import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { PGlite } from '@electric-sql/pglite';
import { STAGES } from '../src/design-system/tokens.js';
import { stgC } from '../src/app/constants/crm.js';

test('server historical fallback preserves each registered client pipeline', () => {
  const sql=readFileSync('supabase/migrations/274_platform_crm_gateway.sql','utf8');
  const registry=JSON.parse(sql.match(/v_static jsonb := '(.+)'::jsonb;/)[1].replaceAll("''","'"));
  const readConfig=(path,tenantConfig)=>{
    const source=readFileSync(path,'utf8').replace(/^import .*;?$/gm,'').replace('export default','globalThis.config =');
    const box={tenantConfig};vm.runInNewContext(source,box);return box.config;
  };
  const neutral=readConfig('src/clients/tenant/config.js');
  for(const dir of readdirSync('src/clients',{withFileTypes:true}).filter(x=>x.isDirectory()&&x.name!=='_shared')) {
    const cfg=readConfig(`src/clients/${dir.name}/config.js`,neutral);
    const org=cfg?.tenant?.organizationId;if(!org)continue;
    const pipeline=cfg.crm?.pipelines?.flatMap(x=>x.stages)||cfg.crm?.pipeline||STAGES.map(name=>({name,color:stgC[name]||'#64748B'}));
    assert.deepEqual(registry[org],JSON.parse(JSON.stringify(pipeline.map(({name,color})=>({name,color:color||'#64748B'})))),dir.name);
  }
});

test('company CRM binds scope, concurrency, assignment, idempotency and audit without moving profiles', async () => {
  const db = new PGlite();
  const id = n => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const root=id(1),partner=id(2),ordinary=id(3),org=id(10),other=id(11),container=id(12),advisor=id(20),foreign=id(21);
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create function auth.role() returns text language sql stable as $$select current_setting('request.jwt.claim.role',true)$$;
      create table organizations(id uuid primary key,name text,slug text,active boolean default true,parent_organization_id uuid,meta_config jsonb default '{}');
      create table profiles(id uuid primary key,organization_id uuid,name text,role text,active boolean default true);
      create table platform_admins(user_id uuid primary key,active boolean default true,scope_organization_id uuid);
      create table leads(id uuid primary key,organization_id uuid not null,name text not null,phone text,email text,
        stage text,asesor_id uuid,asesor_name text,budget text,presupuesto bigint default 0,project text,campaign text,source text,
        notas text,next_action text,next_action_at timestamptz,selected_time timestamptz,visita_at timestamptz,action_history jsonb default '[]',score integer default 5,is_new boolean,
        created_at timestamptz default clock_timestamp(),updated_at timestamptz default clock_timestamp(),deleted_at timestamptz);
      create table expediente_items(id uuid primary key default gen_random_uuid(),organization_id uuid,lead_id uuid,
        descripcion text,titulo text,tipo text,metadata jsonb,created_at timestamptz default now(),asesor_id uuid,deleted_at timestamptz);
      create table audit_log(id uuid primary key default gen_random_uuid(),actor_id uuid,actor_name text,actor_role text,
        organization_id uuid,entity_type text,entity_id uuid,action text,changed_fields jsonb,metadata jsonb);
      create table org_stages(organization_id uuid,nombre text,orden integer,color text,activo boolean default true,deleted_at timestamptz);
      grant usage on schema public,auth to anon,authenticated,service_role;
    `);
    await db.query('insert into organizations(id,name,slug,parent_organization_id,meta_config) values($1,\'Company\',\'company\',$2,$3),($4,\'Other\',\'other\',null,\'{}\'),($2,\'Partner\',\'partner\',null,\'{}\')',
      [org,container,JSON.stringify({crm:{pipeline:[{name:'Prospecto',color:'#123456'},{name:'Ganado',color:'#34D399'}]}}),other]);
    for(const [person,name,role,company] of [[root,'Root','super_admin',other],[partner,'Partner','super_admin',container],[ordinary,'Ordinary','super_admin',org],[advisor,'Advisor','asesor',org],[foreign,'Foreign','asesor',other]])
      await db.query('insert into profiles(id,name,role,organization_id) values($1,$2,$3,$4)',[person,name,role,company]);
    await db.query('insert into platform_admins(user_id,scope_organization_id) values($1,null),($2,$3)',[root,partner,container]);
    const sql=readFileSync('supabase/migrations/274_platform_crm_gateway.sql','utf8');
    await db.exec(sql);await db.exec(sql);
    const read=async(actor=root,company=org,lead=null,search='',page=0,size=50)=>(await db.query('select fn_platform_crm_read($1,$2,$3,$4,$5,$6) result',[actor,company,lead,page,size,search])).rows[0].result;
    const mutate=async(lead,patch,{actor=root,company=org,create=false,version=null}={})=>(await db.query('select fn_platform_crm_mutate($1,$2,$3,$4,$5,$6) result',[actor,company,lead,version,JSON.stringify(patch),create])).rows[0].result;
    await db.exec("select set_config('request.jwt.claim.role','authenticated',false)");
    await assert.rejects(read(),/Sólo el servidor/);
    for(const role of ['anon','authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(read(),/permission denied/);
      await db.exec('reset role');
    }
    await db.exec("select set_config('request.jwt.claim.role','service_role',false)");
    await assert.rejects(read(ordinary),/no está autorizado/);
    await assert.rejects(read(partner,other),/No tienes acceso/);
    const first={name:'Cliente % especial',phone:'+52 686 123 4567',email:'cliente@example.com',asesor_id:advisor,stage:'Prospecto',notas:'Notas iniciales',presupuesto:150000};
    const created=await mutate(id(100),first,{create:true});
    assert.equal(created.audit_saved,true);assert.equal(created.lead.organization_id,org);assert.equal(created.lead.asesor_name,'Advisor');
    const replay=await mutate(id(100),first,{create:true});assert.equal(replay.replayed,true);
    assert.equal((await db.query("select count(*)::int n from audit_log where metadata->>'source'='platform_crm'")).rows[0].n,1);
    await assert.rejects(mutate(id(100),{...first,name:'Different'},{create:true}),/identificador ya fue utilizado/);
    await assert.rejects(mutate(id(100),first,{company:other,create:true}),/identificador ya fue utilizado/);
    for(const patch of [{name:'Wrong advisor',asesor_id:foreign},{name:'Wrong stage',asesor_id:advisor,stage:'Duke custom'},{name:'Forbidden role',asesor_id:advisor,organization_id:other},{name:'Bad budget',asesor_id:advisor,presupuesto:-1},{name:'Bad date',asesor_id:advisor,next_action_at:'not a date'}])
      await assert.rejects(mutate(id(101),patch,{create:true}));
    await db.query('insert into leads(id,organization_id,name,stage,asesor_id) values($1,$2,\'Foreign lead\',\'Secret\',$3)',[id(200),other,foreign]);
    await db.query('insert into expediente_items(organization_id,lead_id,descripcion,tipo) values($1,$2,\'Own note\',\'nota\'),($3,$2,\'Cross-company note\',\'nota\')',[org,id(100),other]);
    await db.query('insert into expediente_items(organization_id,lead_id,descripcion,tipo,deleted_at) values($1,$2,\'Deleted note\',\'nota\',now())',[org,id(100)]);
    const detail=await read(partner,org,id(100));assert.equal(detail.notes.length,1);assert.equal(detail.notes[0].descripcion,'Own note');
    assert.deepEqual(detail.pipeline.map(x=>x.name),['Prospecto','Ganado']);
    assert.ok(detail.advisors.every(x=>x.id!==foreign));
    await assert.rejects(read(root,org,id(200)),/no existe/);
    const found=await read(root,org,null,'686123');assert.equal(found.total,1);assert.equal(found.leads.length,1);
    const literal=await read(root,org,null,'%');assert.equal(literal.total,1);
    await db.exec("create table qa_stage_events(id integer generated always as identity); create function qa_stage_touch() returns trigger language plpgsql as $$begin insert into qa_stage_events default values;return new;end$$; create trigger qa_stage_touched after update of stage on leads for each row execute function qa_stage_touch();");
    const updated=await mutate(id(100),{stage:'Ganado',notas:'Saved by root'},{version:created.lead.updated_at});
    assert.equal(updated.lead.stage,'Ganado');assert.equal(updated.lead.notas,'Saved by root');
    assert.match(updated.lead.action_history[0].action,/Prospecto → Ganado/);
    await assert.rejects(mutate(id(100),{name:'Stale overwrite'},{version:created.lead.updated_at}),/otra sesión/);
    await assert.rejects(mutate(id(100),{asesor_id:foreign},{version:updated.lead.updated_at}),/asesor no está activo/);
    await mutate(id(102),{name:'Another client',asesor_id:advisor},{create:true,actor:partner});
    const page=await read(root,org,null,'',0,1);assert.equal(page.total,2);assert.equal(page.leads.length,1);assert.equal(page.has_more,true);
    assert.equal((await read(root,org,null,'',1,1)).has_more,false);
    const profile=(await db.query('select organization_id,role from profiles where id=$1',[root])).rows[0];
    assert.equal(profile.organization_id,other);assert.equal(profile.role,'super_admin');
    // Audit failure must roll back the client write and its business history.
    await db.exec("create function reject_audit() returns trigger language plpgsql as $$begin raise exception 'audit unavailable';end$$; create trigger qa_reject_audit before insert on audit_log for each row execute function reject_audit();");
    await assert.rejects(mutate(id(100),{name:'Must roll back'},{version:updated.lead.updated_at}),/audit unavailable/);
    assert.equal((await read(root,org,id(100))).lead.name,first.name);
    await db.exec('drop trigger qa_reject_audit on audit_log');
    const noteOnly=await mutate(id(100),{notas:'Only note changed'},{version:updated.lead.updated_at});
    assert.equal(noteOnly.lead.notas,'Only note changed');
    assert.equal((await db.query('select count(*)::int n from qa_stage_events')).rows[0].n,1,'unrelated notes must not fire UPDATE OF stage triggers');
    await db.query("update organizations set meta_config=jsonb_set(meta_config,'{crm,pipeline}',meta_config#>'{crm,pipeline}'||'[{\"name\":\"Zoom Agendado\",\"color\":\"#123456\"}]'::jsonb) where id=$1",[org]);
    await assert.rejects(mutate(id(100),{stage:'Zoom Agendado'},{version:noteOnly.lead.updated_at}),/requiere fecha/);
    const appointment=await mutate(id(100),{stage:'Zoom Agendado',next_action_at:'2026-12-01T16:00:00Z'},{version:noteOnly.lead.updated_at});
    assert.equal(new Date(appointment.lead.next_action_at).toISOString(),'2026-12-01T16:00:00.000Z');
    assert.equal(new Date((await db.query('select selected_time from leads where id=$1',[id(100)])).rows[0].selected_time).toISOString(),'2026-12-01T16:00:00.000Z');
    // Reproduce the actual historical trigger: it resolves UUID by name and
    // LIMIT 1, even when an inactive namesake precedes the selected profile.
    await db.query('insert into profiles(id,organization_id,name,role,active) values($1,$3,\'Homonym\',\'asesor\',false),($2,$3,\'Homonym\',\'asesor\',true)',[id(23),id(24),org]);
    await db.exec(`create function qa_legacy_sync_asesor() returns trigger language plpgsql as $$declare v_resolved_id uuid; begin
      if new.asesor_name is null or btrim(new.asesor_name)='' then new.asesor_id:=null;return new;end if;
      select id into v_resolved_id from profiles where lower(btrim(name))=lower(btrim(new.asesor_name))
        and (organization_id is null or new.organization_id is null or organization_id=new.organization_id)
        order by (organization_id=new.organization_id) desc nulls last limit 1;
      new.asesor_id:=v_resolved_id;return new;end$$;
      create trigger qa_legacy_asesor before insert or update of asesor_name,organization_id on leads for each row execute function qa_legacy_sync_asesor();`);
    const beforeHomonym=(await read(root,org,id(100))).lead;
    const auditBefore=(await db.query('select count(*)::int n from audit_log')).rows[0].n;
    await assert.rejects(mutate(id(103),{name:'New homonym lead',asesor_id:id(24)},{create:true}),/asesor seleccionado/);
    assert.equal((await db.query('select count(*)::int n from leads where id=$1',[id(103)])).rows[0].n,0,'rejected create leaves no client');
    await assert.rejects(mutate(id(100),{asesor_id:id(24),notas:'Must roll back'},{version:beforeHomonym.updated_at}),/asesor seleccionado/);
    assert.deepEqual((await read(root,org,id(100))).lead,beforeHomonym,'wrong legacy resolution rolls back fields/history/version together');
    assert.equal((await db.query('select count(*)::int n from audit_log')).rows[0].n,auditBefore);
    // An AFTER trigger can re-update the stored row after RETURNING is built.
    await db.exec(`create function qa_after_assignment() returns trigger language plpgsql as $$begin
      update leads set asesor_id='${foreign}' where id=new.id;return null;end$$;
      create trigger qa_after_assignment after insert on leads for each row execute function qa_after_assignment();`);
    await assert.rejects(mutate(id(104),{name:'After trigger lead',asesor_id:advisor},{create:true}),/asesor seleccionado/);
    assert.equal((await db.query('select count(*)::int n from leads where id=$1',[id(104)])).rows[0].n,0);
    await db.exec('drop trigger qa_after_assignment on leads');
    await db.query('update profiles set active=false where id=$1',[partner]);await assert.rejects(read(partner),/no está autorizado/);
    await db.query('update organizations set active=false where id=$1',[org]);await assert.rejects(read(root),/desactivada/);
    await db.query('insert into org_stages(organization_id,nombre,orden,color) values($1,\'First custom\',1,\'#123456\')',[other]);
    await db.query('insert into org_stages(organization_id,nombre,orden,color,activo) values($1,\'Inactive custom\',0,\'#123456\',false)',[other]);
    await db.query('insert into org_stages(organization_id,nombre,orden,color,deleted_at) values($1,\'Deleted custom\',0,\'#123456\',now())',[other]);
    assert.equal((await read(root,other)).pipeline[0].name,'First custom');
    assert.ok((await read(root,other)).pipeline.every(x=>!['Inactive custom','Deleted custom'].includes(x.name)));
  } finally { await db.close(); }
});
