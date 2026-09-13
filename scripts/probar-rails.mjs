import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
let pruebas = 0;
async function test(nombre, fn) { await fn(); pruebas++; console.log(`✓ ${nombre}`); }
const vite = await createServer({ server: { middlewareMode: true }, logLevel: 'silent' });
const db = new PGlite();
try {
  const { proximaAccion, listaDelDia, normalizarLead, diaRails } = await vite.ssrLoadModule('/src/lib/next-action-engine.js');
  const { rutaVistaPreviaRails } = await vite.ssrLoadModule('/src/lib/rails-preview.js');
  await test('vista previa conserva la empresa por ruta, subdominio o parámetro', () => {
    for (const href of ['https://app.stratoscapitalgroup.com/grupo28?rails=0','https://grupo28.stratoscapitalgroup.com/','http://localhost:5178/?app&client=vega&rails=false']) {
      const origen = new URL(href);
      const destino = new URL(rutaVistaPreviaRails(href), origen);
      assert.equal(destino.pathname, origen.pathname);
      assert.equal(destino.host, origen.host);
      assert.equal(destino.searchParams.get('client'), origen.searchParams.get('client'));
      assert.equal(destino.searchParams.get('rails'), '1');
      assert.ok(destino.searchParams.has('app'));
    }
  });
  await test('vista previa no copia fragmentos de autenticación', () => {
    assert.equal(new URL(rutaVistaPreviaRails('https://app.stratoscapitalgroup.com/#access_token=ejemplo'), 'https://app.stratoscapitalgroup.com').hash, '');
  });
  const { fusionarRails } = await vite.ssrLoadModule('/src/lib/rails-config.js');
  const { crearRailsStore } = await vite.ssrLoadModule('/src/lib/rails-store.js');
  const { prepararGestion, rechazoDefinitivoRails, resumenAgenda } = await vite.ssrLoadModule('/src/lib/rails-gestion.js');
  await test('validación ignora espacios y permite corregir sin crear un envío', () => {
    const d={detalle:' a ',siguiente:'Enviar propuesta',fecha:'2099-01-01T10:00:00Z'};
    assert.throws(()=>prepararGestion(d),/tres caracteres/);
    assert.equal(prepararGestion({...d,detalle:' Solicita propuesta '}).detalle,'Solicita propuesta');
    assert.throws(()=>prepararGestion({...d,detalle:'válido',siguiente:'  x  '}),/tres caracteres/);
  });
  await test('un rechazo SQL se puede editar; un fallo de transporte mantiene identidad', () => {
    assert.equal(rechazoDefinitivoRails({code:'P0001'}),true);
    assert.equal(rechazoDefinitivoRails({code:'42501'}),true);
    assert.equal(rechazoDefinitivoRails({message:'Failed to fetch'}),false);
    assert.equal(rechazoDefinitivoRails({code:'08006'}),false);
  });
  await test('los contadores son personales aunque la agenda incluya cierres del equipo', () => {
    assert.deepEqual(resumenAgenda({a:{estado:'hecho',asesor_id:'ana'},b:{estado:'hecho',asesor_id:'otro'},c:{estado:'movido',asesor_id:'ana'}},'ana'),{hecho:1,movido:1});
  });
  const now = new Date('2026-09-12T16:00:00Z');
  const lead = { id: 'uno', st: 'Seguimiento', hot: true, asesor: 'Ana', next_action: 'Revisar propuesta' };
  await test('excluye bajas, eliminados, cerrados y registros sin identificador', () => {
    for (const parche of [{opt_out:true},{deleted_at:now.toISOString()},{st:'Cierre'},{st:'Descartado'},{st:'Postventa'},{id:null}]) assert.equal(proximaAccion({...lead,...parche},now),null);
  });
  await test('las fechas futuras y la reactivación programada no generan urgencia', () => {
    for (const parche of [{next_action_at:'2026-09-14T10:00:00Z'},{reactivar_at:'2026-09-14T10:00:00Z'},{st:'Zoom Agendado',selected_time:'2026-09-14T10:00:00Z'}]) assert.equal(proximaAccion({...lead,...parche},now),null);
  });
  await test('Zoom de hoy, pasado y sin fecha requieren acciones distintas', () => {
    assert.equal(proximaAccion({...lead,st:'Zoom Agendado',selected_time:'2026-09-12T18:00:00Z'},now,{timeZone:'UTC'}).tipo,'zoom_hoy');
    assert.equal(proximaAccion({...lead,st:'Zoom Agendado',selected_time:'2026-09-11T18:00:00Z'},now,{timeZone:'UTC'}).tipo,'zoom_vencido');
    assert.equal(proximaAccion({...lead,st:'Zoom Agendado',nextActionDate:'Mañana'},now).tipo,'definir_paso');
  });
  await test('promesas usan snake_case y ganan a la etiqueta caliente', () => assert.equal(proximaAccion({...lead,next_action_at:'2026-09-11T10:00:00Z'},now).tipo,'promesa_vencida'));
  await test('isNew no vuelve primer contacto a alguien en segundo intento', () => assert.notEqual(proximaAccion({...lead,isNew:true,st:'Segundo Intento'},now).tipo,'primer_contacto'));
  await test('editar metadatos no reinicia el reloj de contacto', () => assert.equal(normalizarLead({...lead,last_contact_at:'2026-09-01T16:00:00Z',updated_at:now.toISOString()},now).diasSinTocar,11));
  await test('sacar un bloque no oculta el resto; los duplicados no inflan el total', () => {
    const leads = Array.from({length:15},(_,i)=>({...lead,id:String(i)}));
    const cerradas = Object.fromEntries(leads.slice(0,7).map(l=>[l.id,{estado:'hecho'}]));
    const lista = listaDelDia([...leads,leads[0]],{ahora:now,cerradas});
    assert.equal(lista.total,8); assert.equal(lista.visibles.length,7);
  });
  await test('mantiene el orden pero actualiza teléfono y retira un opt-out', () => {
    const lista = listaDelDia([{...lead,id:'a',phone:'nuevo'},{...lead,id:'b',opt_out:true}],{ahora:now,orden:['b','a']});
    assert.equal(lista.visibles.length,1); assert.equal(lista.visibles[0].telefono,'nuevo');
  });
  await test('un siguiente paso del mismo día reaparece al vencer', () => {
    assert.equal(listaDelDia([{...lead,next_action_at:'2026-09-12T15:00:00Z'}],{ahora:now,cerradas:{uno:{estado:'hecho',completado_at:'2026-09-12T12:00:00Z'}}}).total,1);
  });
  await test('configuración corrupta no apaga la regla fija ni produce topes inválidos', () => {
    const c = fusionarRails({maxTarjetas:null,reglas:{definir_paso:{activa:false,peso:null}}});
    assert.equal(c.maxTarjetas,7); assert.equal(c.reglas.definir_paso.activa,true); assert.equal(c.reglas.definir_paso.peso,50);
    assert.equal(listaDelDia([lead],{max:-1,ahora:now}).visibles.length,1);
  });
  await test('el día se calcula en la zona de trabajo, incluido cambio de fecha', () => {
    assert.equal(diaRails(new Date('2026-09-12T02:00:00Z'),'America/Tijuana'),'2026-09-11');
    assert.equal(diaRails(new Date('2026-09-12T02:00:00Z'),'UTC'),'2026-09-12');
  });
  await test('una respuesta tardía de otra empresa no sustituye la configuración actual', async () => {
    let responderA;
    const store = crearRailsStore({leer:org=>org==='a'?new Promise(resolve=>{responderA=resolve;}):Promise.resolve({activo:false}),escribir:async c=>c});
    const a=store.cargar('user:a','a'); await store.cargar('user:b','b'); responderA({activo:true}); await a;
    assert.equal(store.get('user:b').cfg.activo,false); assert.equal(store.get('user:a').cfg.activo,true);
  });
  await test('guardar con fallo conserva la versión confirmada y permite reintentar', async () => {
    let fallo=true;
    const store=crearRailsStore({leer:async()=>({activo:false}),escribir:async c=>{if(fallo)throw Error('Sin red');return c;}});
    await store.cargar('a','a');
    assert.equal((await store.guardar('a',{activo:true})).ok,false); assert.equal(store.get('a').cfg.activo,false);
    fallo=false; assert.equal((await store.guardar('a',{activo:true})).ok,true); assert.equal(store.get('a').cfg.activo,true);
  });
  await test('dos guardados simultáneos no pisan el último estado', async () => {
    let terminar; const store=crearRailsStore({leer:async()=>({activo:false}),escribir:()=>new Promise(r=>{terminar=r;})});
    await store.cargar('a','a'); const primero=store.guardar('a',{activo:true});
    assert.equal((await store.guardar('a',{activo:false})).ok,false); terminar({activo:true}); await primero;
    assert.equal(store.get('a').cfg.activo,true);
  });
  // PostgreSQL real embebido; fixture mínimo del contrato usado por 243, sin conexión a producción.
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE TABLE profiles(id uuid PRIMARY KEY,organization_id uuid,name text,role text,active boolean);
    CREATE TABLE organizations(id uuid PRIMARY KEY,meta_config jsonb);
    CREATE TABLE leads(id uuid PRIMARY KEY,organization_id uuid,asesor_name text,stage text,deleted_at timestamptz,opt_out boolean DEFAULT false,
      updated_at timestamptz DEFAULT now(),next_action text,next_action_at timestamptz,next_action_date text,sprint_toques int DEFAULT 0,
      sprint_ultimo_canal text,sprint_inicio timestamptz,is_new boolean DEFAULT true,action_history jsonb DEFAULT '[]');
    CREATE TABLE agenda_items(id uuid DEFAULT gen_random_uuid(),organization_id uuid,asesor_id uuid,asesor_name text,lead_id uuid,fecha date,
      orden int DEFAULT 0,tipo text,canal text,razon text,pedir text,estado text,resultado text,completado_at timestamptz,created_at timestamptz DEFAULT now());
    CREATE UNIQUE INDEX agenda_items_lead_dia ON agenda_items(lead_id,fecha) WHERE lead_id IS NOT NULL;
    CREATE TABLE front_rpc_registry(nombre text PRIMARY KEY,nota text);
    CREATE FUNCTION current_organization_id() RETURNS uuid LANGUAGE sql AS $$ SELECT organization_id FROM profiles WHERE id=auth.uid() $$;
    CREATE FUNCTION is_admin_or_above() RETURNS boolean LANGUAGE sql AS $$ SELECT role IN ('admin','super_admin','ceo','director') FROM profiles WHERE id=auth.uid() $$;
    GRANT USAGE ON SCHEMA auth TO authenticated; GRANT SELECT ON profiles, leads TO authenticated;
  `);
  const migration=readFileSync(new URL('../supabase/migrations/243_rails_circuito_confirmado.sql',import.meta.url),'utf8');
  await test('migración 243 ejecutable e idempotente', async () => { await db.exec(migration); await db.exec(migration); });
  const org=randomUUID(), otroOrg=randomUUID(), asesor=randomUUID(), admin=randomUUID(), otro=randomUUID(), lid=randomUUID();
  await db.query(`INSERT INTO organizations VALUES ($1,'{"brand":"intacta"}'),($2,'{}')`,[org,otroOrg]);
  await db.query(`INSERT INTO profiles VALUES ($1,$2,'Ana','asesor',true),($3,$2,'Admin','admin',true),($4,$5,'Otro','admin',true)`,[asesor,org,admin,otro,otroOrg]);
  await db.query(`INSERT INTO leads(id,organization_id,asesor_name,stage) VALUES ($1,$2,'Ana','Seguimiento')`,[lid,org]);
  const actor=async id=>{ await db.query(`select set_config('test.uid',$1,false)`,[id||'']); };
  const row=async()=> (await db.query('select * from leads where id=$1',[lid])).rows[0];
  const futuro=new Date(Date.now()+864e5).toISOString();
  // Obtiene la cadena original de Postgres: conserva microsegundos para el bloqueo optimista.
  const version=async()=> (await db.query('select updated_at::text as v from leads where id=$1',[lid])).rows[0].v;
  const enviar=async(args={})=>db.query('select rails_resolver_accion($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) as r',[
    args.id||randomUUID(),lid,args.version||await version(),'lead_caliente','Prioridad registrada',args.resultado||'contactado',args.detalle??'Interesado; solicita propuesta','llamada','Revisar propuesta',args.fecha??futuro,'America/Tijuana']);
  await test('sin sesión y otra organización no pueden gestionar el lead', async()=>{
    await actor(null); await assert.rejects(enviar(),/sesión activa/); await actor(otro); await assert.rejects(enviar(),/permiso/);
  });
  await test('asesor no puede gestionar un lead ajeno ni sin dueño', async()=>{
    await actor(asesor); await db.query('update leads set asesor_name=null where id=$1',[lid]); await assert.rejects(enviar(),/permiso/);
    await db.query("update leads set asesor_name='Otra asesora' where id=$1",[lid]); await assert.rejects(enviar(),/permiso/);
    await db.query("update leads set asesor_name='Ana' where id=$1",[lid]);
  });
  await test('una cuenta inactiva no puede escribir',async()=>{
    await db.query('update profiles set active=false where id=$1',[asesor]); await assert.rejects(enviar(),/sesión activa/);
    await db.query('update profiles set active=true where id=$1',[asesor]);
  });
  await test('una baja de contacto bloquea también el RPC',async()=>{
    await db.query('update leads set opt_out=true where id=$1',[lid]); await assert.rejects(enviar(),/no admite/); await db.query('update leads set opt_out=false where id=$1',[lid]);
  });
  await test('un registro incompleto no deja ni evento ni próximo paso',async()=>{
    await assert.rejects(enviar({detalle:''}),/resultado/); await assert.rejects(enviar({fecha:'2020-01-01T00:00:00Z'}),/fecha futura/);
    assert.equal((await db.query('select count(*)::int as n from rails_eventos')).rows[0].n,0); assert.equal((await row()).next_action,null);
  });
  let request, savedVersion;
  await test('resultado y compromiso se guardan juntos y el reintento no duplica toques',async()=>{
    request=randomUUID(); savedVersion=await version(); await enviar({id:request,version:savedVersion}); await enviar({id:request,version:savedVersion});
    assert.equal((await row()).sprint_toques,1); assert.equal((await row()).next_action,'Revisar propuesta'); assert.equal((await row()).action_history.length,1);
    assert.equal((await db.query('select count(*)::int as n from rails_eventos')).rows[0].n,1);
    assert.equal((await db.query('select estado from agenda_items')).rows[0].estado,'hecho');
  });
  await test('una tarjeta obsoleta no pisa el siguiente paso',async()=>await assert.rejects(enviar({version:savedVersion}),/ficha cambió/));
  await test('reprogramar conserva el contador de contactos y agrega evidencia',async()=>{
    await enviar({resultado:'reprogramado'}); assert.equal((await row()).sprint_toques,1);
    assert.equal((await db.query('select count(*)::int as n from rails_eventos')).rows[0].n,2);
  });
  await test('agenda respeta organización, asignación y zona válida',async()=>{
    assert.equal((await db.query("select * from rails_agenda_del_dia('America/Tijuana')")).rows.length,1);
    await assert.rejects(db.query("select * from rails_agenda_del_dia('inventada')"),/Zona horaria/);
    await actor(otro); assert.equal((await db.query("select * from rails_agenda_del_dia('America/Tijuana')")).rows.length,0);
  });
  await test('configuración requiere admin; preserva marca y rechaza ediciones obsoletas',async()=>{
    await actor(asesor); await assert.rejects(db.query(`select rails_guardar_config('{"activo":true}',null,$1)`,[org]),/administrador/);
    await actor(admin); await db.query(`select rails_guardar_config('{"activo":true}',null,$1)`,[org]);
    assert.equal((await db.query('select meta_config from organizations where id=$1',[org])).rows[0].meta_config.brand,'intacta');
    await assert.rejects(db.query(`select rails_guardar_config('{"activo":false}',null,$1)`,[org]),/Otro administrador/);
  });
  await test('cambiar de organización durante el guardado no escribe en la nueva empresa',async()=>{
    await actor(otro); await assert.rejects(db.query(`select rails_guardar_config('{"activo":true}',null,$1)`,[org]),/organización de la sesión cambió/);
  });
  await test('dos tarjetas con la misma versión solo producen una gestión',async()=>{
    await actor(asesor); const v=await version();
    const respuestas=await Promise.allSettled([enviar({version:v}),enviar({version:v})]);
    assert.equal(respuestas.filter(r=>r.status==='fulfilled').length,1);
  });
  await test('usuario autenticado no puede escribir evidencia ni saltarse el nuevo contrato',async()=>{
    await actor(asesor); await db.exec('SET ROLE authenticated');
    await assert.rejects(db.query(`insert into agenda_items(lead_id) values($1)`,[lid]),/permission denied/);
    await assert.rejects(db.query('delete from rails_eventos'),/permission denied/);
    await assert.rejects(db.query('select rails_marcar_accion($1,$2,$3)',[lid,'test','test']),/Actualiza Stratos/);
    await enviar();
    const visibles=await db.query('select * from rails_eventos'); assert.ok(visibles.rows.every(r=>r.organization_id===org));
    await db.exec('RESET ROLE');
  });
  console.log(`\n${pruebas} pruebas de Rails aprobadas. Sin escrituras en producción.`);
} finally { await db.close(); await vite.close(); }
