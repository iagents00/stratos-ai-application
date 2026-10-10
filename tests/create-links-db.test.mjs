import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { normalizeLinkName } from '../src/app/views/LandingPages/link-name.js';

test('readable link names normalize accents and bound length', () => {
 assert.equal(normalizeLinkName('Adoquín Inmobiliaria'), 'adoquin-inmobiliaria');
 assert.equal(normalizeLinkName('Real Estate 33'), 'real-estate-33');
 assert.equal(normalizeLinkName(' /?# '), '');
 assert.equal(normalizeLinkName('a'.repeat(100)).length,32);
});

test('portfolio links are tenant-owned, unpredictable and publicly resolvable only by code', async () => {
 const db=new PGlite();
 const a='10000000-0000-4000-8000-000000000001', b='10000000-0000-4000-8000-000000000002';
 try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create table profiles(id uuid,organization_id uuid,active boolean default true,crm_only boolean default false,role text default 'admin');
   create table organizations(id uuid,name text,active boolean default true,meta_config jsonb);
   create table portfolio_links(code text primary key,payload text,created_by uuid,organization_id uuid,hits integer default 0);
   grant usage on schema public,auth to anon,authenticated;`);
  for(const id of [a,b]) {
   await db.query(`insert into organizations values($1,'Adoquín Inmobiliaria',true,'{"features":{"landingPages":true}}')`,[id]);
   await db.query('insert into profiles(id,organization_id) values($1,$1)',[id]);
  }
  await db.exec(readFileSync('supabase/migrations/270_create_branded_links.sql','utf8'));
  const login=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
  const create=async name=>(await db.query('select create_portfolio_link($1,$2) code',['test-payload',name])).rows[0].code;
  await login(a);
  const first=await create('Adoquín Inmobiliaria');
  assert.match(first,/^adoquin-inmobiliaria-[a-f0-9]{20}$/);
  const long=await create('a'.repeat(100));assert.equal(long.length,53);
  await login(b); const second=await create('Adoquín Inmobiliaria');assert.notEqual(first,second);
  await assert.rejects(db.query('select * from portfolio_links'),/permission denied/);
  await db.exec('reset role');
  assert.deepEqual((await db.query('select organization_id,created_by from portfolio_links where code=$1',[first])).rows[0],{organization_id:a,created_by:a});
  for(const change of ["active=false","crm_only=true","role='colaborador'"]) {
   await db.exec(`update profiles set ${change} where id='${b}'`);await login(b);
   await assert.rejects(create('denied'),/no está habilitado/);
   await db.exec(`reset role; update profiles set active=true,crm_only=false,role='admin' where id='${b}'`);
  }
  await db.exec(`update organizations set meta_config='{}' where id='${b}'`);await login(b);
  await assert.rejects(create('disabled'),/no está habilitado/);
  await db.exec("reset role; insert into portfolio_links(code,payload) values('ab','legacy'),('abcdefghijklmnopqrstuvwxyzabcdefghijklmn','legacy'); set role anon");
  for(const code of ['ab','abcdefghijklmnopqrstuvwxyzabcdefghijklmn']) assert.equal((await db.query('select resolve_portfolio_link($1) payload',[code])).rows[0].payload,'legacy');
  await assert.rejects(create('anonymous'),/permission denied/);
  await assert.rejects(db.query('select * from portfolio_links'),/permission denied/);
  for(const code of [first,long]) assert.equal((await db.query('select resolve_portfolio_link($1) payload',[code])).rows[0].payload,'test-payload');
  assert.equal((await db.query("select resolve_portfolio_link('../bad') payload")).rows[0].payload,null);
 } finally { await db.close(); }
});
