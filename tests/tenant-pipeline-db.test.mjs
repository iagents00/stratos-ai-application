import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { PGlite } = await import(process.env.STRATOS_PGLITE_MODULE || '@electric-sql/pglite');

test('tenant pipeline enforces scope, preserves clients and synchronizes assistant stages atomically', async () => {
  const db = new PGlite();
  const own='10000000-0000-4000-a000-000000000001', other='10000000-0000-4000-a000-000000000002';
  const admin='20000000-0000-4000-a000-000000000001', advisor='20000000-0000-4000-a000-000000000002';
  const pipeline=[{name:'Initial',color:'#94A3B8'},{name:'Won',color:'#34D399'}];
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table organizations(id uuid primary key,name text,active boolean,meta_config jsonb,updated_at timestamptz);
      create table profiles(id uuid primary key,organization_id uuid,role text,active boolean,crm_only boolean,is_marketing_admin boolean);
      create table leads(id uuid default gen_random_uuid(),organization_id uuid,stage text,deleted_at timestamptz);
      create table org_stages(id uuid primary key default gen_random_uuid(),organization_id uuid,orden integer,nombre text,color text,
        activo boolean default true,deleted_at timestamptz,grupo text,unique(organization_id,orden),unique(organization_id,nombre));
      create function fn_platform_crm_pipeline(p_organization_id uuid) returns jsonb language sql as $$
        select coalesce(meta_config#>'{crm,pipeline}','[{"name":"Initial","color":"#94A3B8"},{"name":"Won","color":"#34D399"}]')
        from organizations where id=p_organization_id $$;`);
    for (const [id,name] of [[own,'Own'],[other,'Other']]) {
      await db.query(`insert into organizations values($1,$2,true,$3,'2026-11-04T00:00:00Z')`,
        [id,name,{documents:[{title:'Kept'}],crm:{labels:{entity:'cliente'},pipeline}}]);
      for (const [i,stage] of pipeline.entries()) await db.query('insert into org_stages(organization_id,orden,nombre,color) values($1,$2,$3,$4)',[id,i+1,stage.name,stage.color]);
    }
    await db.query(`insert into profiles values($1,$2,'admin',true,false,false),($3,$2,'asesor',true,false,false)`,[admin,own,advisor]);
    await db.exec(readFileSync('supabase/migrations/275_tenant_pipeline_save.sql','utf8'));
    const save=(actor,org,draft,at='2026-11-04T00:00:00Z')=>db.query('select fn_tenant_pipeline_save($1,$2,$3,$4) as result',[actor,org,at,draft]);
    await assert.rejects(save(admin,other,pipeline),{code:'42501'});
    await assert.rejects(save(advisor,own,pipeline),{code:'42501'});
    await assert.rejects(save(admin,own,pipeline,null),{code:'40001'});
    await assert.rejects(save(admin,own,[pipeline[0]]),{code:'22023'});
    await assert.rejects(save(admin,own,[pipeline[0],{...pipeline[0],name:'initial'}]),{code:'22023'});
    await db.exec('set role authenticated');
    await assert.rejects(save(admin,own,pipeline),{code:'42501'});
    await db.exec('reset role');
    await db.query('insert into leads(organization_id,stage) values($1,$2),($3,$4)',[own,'Initial',other,'Other secret']);
    const draft=[{name:'Won',color:'#123456'},{name:'First contact',color:'#ABCDEF'}];
    await db.exec('set role service_role');
    const saved=(await save(admin,own,draft)).rows[0].result;
    await db.exec('reset role');
    assert.deepEqual(saved.pipeline.map(s=>s.name),['Won','First contact','Initial']);
    assert.deepEqual(saved.preserved_stages,{Initial:1});
    assert.equal(saved.organization.meta_config.documents[0].title,'Kept');
    assert.equal(saved.organization.meta_config.crm.labels.entity,'cliente');
    assert.equal(saved.organization.meta_config.crm.pipelineUpdatedBy,admin);
    assert.deepEqual((await db.query('select nombre,color from org_stages where organization_id=$1 and activo and deleted_at is null order by orden',[own])).rows,
      saved.pipeline.map(s=>({nombre:s.name,color:s.color})));
    assert.deepEqual((await db.query('select nombre from org_stages where organization_id=$1 and activo order by orden',[other])).rows.map(s=>s.nombre),['Initial','Won']);
    assert.deepEqual((await db.query('select stage from leads where organization_id=$1',[own])).rows,[{stage:'Initial'}]);
    await assert.rejects(save(admin,own,draft),{code:'40001'});
    const next=(await save(admin,own,pipeline,saved.updated_at)).rows[0].result;
    assert.deepEqual((await db.query('select nombre from org_stages where organization_id=$1 and activo order by orden',[own])).rows.map(s=>s.nombre),['Initial','Won']);
    assert.equal((await db.query("select activo from org_stages where organization_id=$1 and nombre='First contact'",[own])).rows[0].activo,false);
    await save(admin,own,[...pipeline,{name:'First contact',color:'#ABCDEF'}],next.updated_at);
    assert.equal((await db.query("select count(*)::int n from org_stages where organization_id=$1 and nombre='First contact'",[own])).rows[0].n,1);
    await db.query('update profiles set active=false where id=$1',[admin]);
    await assert.rejects(save(admin,own,pipeline),{code:'42501'});
  } finally { await db.close(); }
});
