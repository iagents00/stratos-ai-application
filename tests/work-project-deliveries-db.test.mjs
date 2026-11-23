import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("delivery workflow checks tenant, actor, evidence, dependencies and agent review", async () => {
  const db = new PGlite();
  const [org, outside, founder, worker, reviewer, stranger, project, delivery, report] = Array.from({length: 9}, randomUUID);
  const first = async (sql, params) => (await db.query(sql, params)).rows[0]?.result;
  const become = async (id) => {
    await db.exec("reset role");
    await db.query("select set_config('test.uid',$1,false)", [id]);
    await db.exec("set role authenticated");
  };
  const action = (name, payload, tenant = org) => first("select work_project_action($1,$2,$3) result", [tenant,name,payload]);
  const snapshot = (id = null) => first("select work_project_snapshot($1,$2) result", [org,id]);
  const agent = (version, run = null, result = null) => first("select work_project_agent($1,$2,$3,$4,$5,$6) result", [org,founder,report,version,run,result]);
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
      create table public.organizations(id uuid primary key, active boolean, meta_config jsonb);
      create table public.profiles(id uuid primary key, organization_id uuid, active boolean, crm_only boolean, role text, name text);
      create table public.front_rpc_registry(nombre text primary key, nota text);
    `);
    await db.query("insert into organizations values($1,true,$3),($2,true,$3)", [org,outside,{features:{projectWorkspace:true}}]);
    await db.query(`insert into profiles values
      ($1,$5,true,false,'ceo','Founder'),($2,$5,true,false,'colaborador','Worker'),
      ($3,$5,true,false,'colaborador','Reviewer'),($4,$6,true,false,'ceo','Outside')`, [founder,worker,reviewer,stranger,org,outside]);
    await db.exec(readFileSync("supabase/migrations/326_project_delivery_workspace.sql","utf8"));
    await become(founder);
    const proposal = { id:project,title:"Pilot",outcome:"Measure outcome" };
    assert.equal((await action("create_project",proposal)).id,project);
    assert.equal((await action("create_project",proposal)).id,project);
    await assert.rejects(action("create_project",{...proposal,title:"Changed"}),/identificador/);
    const draft = {project_id:project,title:"Prepare evidence",outcome:"Evidence ready",
      criteria:["Sources verified"],assignee_id:worker,reviewer_id:reviewer,executor:"person",due_on:"2026-11-23"};
    await assert.rejects(action("create_delivery",{...draft,id:delivery,reviewer_id:stranger}),/personas activas/);
    let card = await action("create_delivery",{...draft,id:delivery});
    const agentCard = await action("create_delivery",{...draft,id:report,title:"Progress report",executor:"progress_report",
      assignee_id:founder,depends_on:delivery});
    assert.equal((await snapshot()).deliveries.find((r)=>r.id===report).waiting,true);
    await assert.rejects(agent(agentCard.version),/permission denied/);
    await assert.rejects(db.query("select * from work_deliveries"),/permission denied/);
    await become(stranger);
    await assert.rejects(snapshot(),/no está disponible/);
    await become(worker);
    assert.deepEqual((await snapshot()).deliveries.map((r)=>r.id),[delivery]);
    await assert.rejects(snapshot(report),/no disponible/);
    await assert.rejects(action("create_project",{...proposal,id:randomUUID()}),/no puede crear/);
    await action("focus",{id:delivery});
    assert.equal((await snapshot()).focus,delivery);
    card = await action("start",{id:delivery,version:card.version});
    await assert.rejects(action("save",{id:delivery,version:1,checked:[true]}),/cambió/);
    await assert.rejects(action("submit",{id:delivery,version:card.version,checked:[true],evidence:""}),/evidencia/);
    card = await action("submit",{id:delivery,version:card.version,checked:[true],evidence:"Verified finding"});
    await assert.rejects(action("approve",{id:delivery,version:card.version}),/No tienes permiso/);
    await become(reviewer);
    card = await action("return",{id:delivery,version:card.version,note:"Check the measure"});
    await become(worker);
    card = await action("submit",{id:delivery,version:card.version,checked:[true],evidence:"Verified measure"});
    await become(reviewer);
    assert.equal((await action("approve",{id:delivery,version:card.version})).state,"approved");
    assert.ok((await snapshot(delivery)).events.some((event)=>event.action==="return"));
    await db.exec("reset role; set role service_role");
    const { run } = await agent(agentCard.version);
    await assert.rejects(agent(agentCard.version),/curso/);
    assert.equal((await agent(agentCard.version,run,"Evidence-based progress report")).status,"review");
    await assert.rejects(agent(agentCard.version,run,"Late update"),/vigente/);
    await become(reviewer);
    const waitingReview = (await snapshot(report)).deliveries.find((entry)=>entry.id===report);
    await assert.rejects(action("approve",{id:report,version:waitingReview.version,checked:[false]}),/criterio/);
    assert.equal((await action("approve",{id:report,version:waitingReview.version,checked:[true]})).state,"approved");
    await db.exec("reset role");
    await db.query("update profiles set active=false where id=$1",[worker]);
    await become(worker);
    await assert.rejects(snapshot(),/no está disponible/);
  } finally {
    await db.close();
  }
});
