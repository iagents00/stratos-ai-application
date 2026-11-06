import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { leadDocuments, contactChannels, documentFileExtension, DOCUMENT_MAX_BYTES } from '../src/lib/lead-documents.mjs';
import { proximaAccion } from '../src/lib/next-action-engine.js';
import { CIERRE_STAGES } from '../src/app/views/CRM/zoom-metrics.js';
const { PGlite } = await import(process.env.STRATOS_PGLITE_MODULE || '@electric-sql/pglite');

test('legacy identifications and contact channels remain readable; uploads reject unsupported or oversized files', () => {
  const legacy = { id: 'legacy', n: 'Cliente de prueba', id_document: 'PAS-TEST', id_document_path: 'id-doc/test/example.pdf' };
  assert.equal(leadDocuments(legacy)[0].number, 'PAS-TEST');
  assert.equal(leadDocuments(legacy)[0].path, legacy.id_document_path);
  assert.deepEqual(leadDocuments({ ...legacy, documents: [{ id: 'new' }] }), [{ id: 'new' }]);
  assert.deepEqual(contactChannels({ phone: '+52 5550000000' }, 'phone'), ['+52 5550000000']);
  assert.deepEqual(contactChannels({ emails: [' Demo@example.com ', 'demo@example.com', '', 'second@example.com'] }, 'email'), ['Demo@example.com', 'second@example.com']);
  assert.equal(documentFileExtension({ size: 50, type: 'application/pdf', name: 'a.html' }), 'pdf');
  for (const file of [{ size: 0, type: 'application/pdf' }, { size: DOCUMENT_MAX_BYTES + 1, type: 'image/png' }, { size: 20, type: 'text/html' }]) assert.throws(() => documentFileExtension(file));
  assert.equal(CIERRE_STAGES.has('Cierres Caídos'), false);
  assert.equal(proximaAccion({ id: 'lost-qa', st: 'Cierres Caídos', isNew: true }), null);
});

test('multiple lead documents preserve legacy data and enforce lead RLS; related contacts retain all channels and admin permissions', async () => {
  const db = new PGlite();
  const org = '00000000-0000-0000-0000-000000000001', other = '00000000-0000-0000-0000-000000000002';
  const lead = '10000000-0000-4000-8000-000000000001', hidden = '10000000-0000-4000-8000-000000000002', foreign = '10000000-0000-4000-8000-000000000003';
  const user = '20000000-0000-4000-8000-000000000001';
  const doc = '30000000-0000-4000-8000-000000000001', offer = '30000000-0000-4000-8000-000000000002';
  const migration = name => readFileSync(`supabase/migrations/${name}`, 'utf8');
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.uid',true),'')::uuid$$;
      GRANT USAGE ON SCHEMA auth TO authenticated,anon;
      CREATE FUNCTION current_organization_id() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.org',true),'')::uuid$$;
      CREATE FUNCTION is_admin_or_above() RETURNS boolean LANGUAGE sql STABLE AS $$SELECT current_setting('test.admin',true)='true'$$;
      CREATE TABLE organizations(id uuid PRIMARY KEY,name text,meta_config jsonb,updated_at timestamptz);
      CREATE TABLE org_stages(id uuid DEFAULT gen_random_uuid(),organization_id uuid,orden int,nombre text,color text,activo boolean,deleted_at timestamptz,UNIQUE(organization_id,orden),UNIQUE(organization_id,nombre));
      CREATE TABLE leads(id uuid PRIMARY KEY,organization_id uuid,owner_id uuid,name text,stage text,notas text,deleted_at timestamptz,id_document text,id_document_path text,updated_at timestamptz);
      CREATE TABLE front_rpc_registry(nombre text PRIMARY KEY,nota text);
      ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
      CREATE POLICY lead_scope ON leads FOR ALL TO authenticated USING(organization_id=current_organization_id() AND (owner_id=auth.uid() OR is_admin_or_above())) WITH CHECK(organization_id=current_organization_id() AND (owner_id=auth.uid() OR is_admin_or_above()));
      GRANT SELECT,UPDATE ON leads TO authenticated;`);
    await db.query('INSERT INTO leads(id,organization_id,owner_id,name,notas,id_document,id_document_path) VALUES($1,$2,$3,$4,$5,$6,$7)', [lead, org, user, 'Cliente QA', 'Notas conservadas', 'LEGACY-123', `id-doc/${org}/${lead}/old.pdf`]);
    await db.query('INSERT INTO leads(id,organization_id,name) VALUES($1,$2,$3),($4,$5,$6)', [hidden, org, 'No visible', foreign, other, 'Otra empresa']);
    await db.exec(migration('104_lead_related_contacts.sql'));
    await db.exec(migration('105_lead_related_contacts_admin_write.sql'));
    const contact = (await db.query('INSERT INTO lead_related_contacts(lead_id,name,phone,email) VALUES($1,$2,$3,$4) RETURNING id', [lead, 'Compradora QA', '+525550000001', 'QA@example.com'])).rows[0].id;
    await db.exec(migration('289_crm_buyer_documents.sql'));
    await db.exec(migration('289_crm_buyer_documents.sql')); // Safe retry, no destructive reset.
    await db.query("SELECT set_config('test.uid',$1,false),set_config('test.org',$2,false),set_config('test.admin','false',false)", [user,org]);
    const save = (id, document, remove = false) => db.query('SELECT fn_lead_document_save($1,$2,$3) result', [id,document,remove]).then(r => r.rows[0].result);
    await db.exec('SET ROLE authenticated');
    const second = { id: doc, kind: 'identity', name: 'Compradora QA · INE', number: 'TEST-2' };
    let saved = await save(lead,second);
    assert.equal(saved.documents.length,2);
    assert.equal(saved.documents[0].number,'LEGACY-123');
    assert.equal(saved.id_document_path,`id-doc/${org}/${lead}/old.pdf`);
    saved = await save(lead,{ id: offer, kind:'offer', name:'Departamento QA 204', path:`id-doc/${org}/${lead}/offer.pdf`,filename:'Carta.pdf' });
    assert.equal(saved.documents.length,3);
    saved = await save(lead,{ ...second, name:'Compradora QA · Pasaporte',number:'TEST-3' });
    assert.equal(saved.documents.length,3);
    assert.equal(saved.documents[1].number,'TEST-3');
    assert.equal((await db.query('SELECT notas FROM leads WHERE id=$1',[lead])).rows[0].notas,'Notas conservadas');
    for (const blocked of [hidden,foreign]) await assert.rejects(save(blocked,second),{code:'42501'});
    await assert.rejects(save(lead,{...second,path:`id-doc/${other}/${lead}/other.pdf`}),{code:'22023'});
    await assert.rejects(save(lead,{...second,path:`id-doc/${org}/${hidden}/other.pdf`}),{code:'22023'});
    await assert.rejects(save(lead,{...second,kind:'arbitrary'}),{code:'22023'});
    await assert.rejects(save(lead,{...second,name:' '}),{code:'22023'});
    await assert.rejects(save(lead,{id:offer,kind:'offer',name:'Sin archivo'}),{code:'22023'});
    const existing = (await db.query('SELECT phones,emails FROM lead_related_contacts WHERE id=$1',[contact])).rows[0];
    assert.deepEqual(existing,{phones:['+525550000001'],emails:['QA@example.com']});
    await assert.rejects(db.query('INSERT INTO lead_related_contacts(lead_id,name) VALUES($1,$2)',[lead,'Asesor no puede crear']),{code:'42501'});
    assert.equal((await db.query('UPDATE lead_related_contacts SET phones=$1 WHERE id=$2 RETURNING id',[['555'],contact])).rows.length,0);
    await db.exec("SELECT set_config('test.admin','true',false)");
    const channels = (await db.query('UPDATE lead_related_contacts SET phones=$1,emails=$2 WHERE id=$3 RETURNING phone,email,phones,emails',
      [[' 5551 ','5552','5551',''],['First@example.com','SECOND@example.com','first@example.com',''],contact])).rows[0];
    assert.deepEqual(channels,{phone:'5551',email:'First@example.com',phones:['5551','5552'],emails:['First@example.com','SECOND@example.com']});
    assert.deepEqual((await db.query('UPDATE lead_related_contacts SET phone=$1 WHERE id=$2 RETURNING phones',['5553',contact])).rows[0].phones,['5553','5552']);
    assert.deepEqual((await db.query('UPDATE lead_related_contacts SET phones=$1,phone=NULL WHERE id=$2 RETURNING phones,phone',[[],contact])).rows[0],{phones:[],phone:null});
    await assert.rejects(db.query('INSERT INTO lead_related_contacts(lead_id,name,phones) VALUES($1,$2,$3)',[lead,'Too many',Array.from({length:21},(_,i)=>String(i))]),{code:'22023'});
    await assert.rejects(db.query('INSERT INTO lead_related_contacts(lead_id,name) VALUES($1,$2)',[foreign,'Foreign']),{code:'42501'});
    saved=await save(lead,{id:lead},true);
    assert.equal(saved.documents.length,2); assert.equal(saved.id_document,'TEST-3');
    saved=await save(lead,{id:doc},true);
    assert.equal(saved.documents.length,1); assert.equal(saved.documents[0].kind,'offer'); assert.equal(saved.id_document,null);
    await db.exec('SET ROLE anon');
    await assert.rejects(save(lead,second),{code:'42501'});
    await db.exec('RESET ROLE');
    // The new terminal stage is scoped to Duke and rerunnable.
    await db.query('INSERT INTO organizations(id,name,meta_config) VALUES($1,$2,$3),($4,$5,$6)',[org,'Duke',{keep:true},other,'Other',{crm:{pipeline:[{name:'Own stage'}]}}]);
    await db.query('INSERT INTO org_stages(organization_id,orden,nombre,color,activo) VALUES($1,1,$2,$3,true),($4,1,$5,$3,true)',[org,'Cierre','#000000',other,'Own stage']);
    await db.exec(migration('290_duke_failed_closings.sql')); await db.exec(migration('290_duke_failed_closings.sql'));
    assert.equal((await db.query("SELECT count(*)::int n FROM org_stages WHERE nombre='Cierres Caídos' AND organization_id=$1",[org])).rows[0].n,1);
    assert.deepEqual((await db.query('SELECT nombre FROM org_stages WHERE organization_id=$1',[other])).rows,[{nombre:'Own stage'}]);
    assert.equal((await db.query('SELECT meta_config FROM organizations WHERE id=$1',[org])).rows[0].meta_config.keep,true);
  } finally { await db.close(); }
});
