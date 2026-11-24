import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const staging = process.argv[2];
assert.ok(staging, "Se requiere la carpeta del Supabase temporal");
const config = JSON.parse(execFileSync("supabase", ["status", "--workdir", staging, "-o", "json"], {
  encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
}));
const api = new URL(config.API_URL);
const db = new URL(config.DB_URL);
assert.ok(["127.0.0.1", "localhost"].includes(api.hostname));
assert.ok(["127.0.0.1", "localhost"].includes(db.hostname));

const pg = (sql) => execFileSync("psql", ["-X", "-v", "ON_ERROR_STOP=1"], {
  input: sql, env: { ...process.env, PGHOST: db.hostname, PGPORT: db.port,
    PGDATABASE: db.pathname.slice(1), PGUSER: db.username, PGPASSWORD: db.password },
  stdio: ["pipe", "ignore", "inherit"],
});
const auth = { persistSession: false, autoRefreshToken: false };
const admin = createClient(api.href, config.SERVICE_ROLE_KEY, { auth });
const checked = async (promise) => {
  const { data, error } = await promise;
  assert.ifError(error);
  return data;
};
async function signIn() {
  const email = `${randomUUID()}@example.test`;
  const password = randomUUID();
  const { user } = await checked(admin.auth.admin.createUser({ email, password, email_confirm: true }));
  const client = createClient(api.href, config.ANON_KEY, { auth });
  await checked(client.auth.signInWithPassword({ email, password }));
  return { id: user.id, client };
}

const [founder, executor, outsider] = await Promise.all([signIn(), signIn(), signIn()]);
const org = "cd478b82-d2ff-4543-981d-fb9d7aa1583e";
const otherOrg = randomUUID();
pg(`
  insert into organizations values ('${org}',true,'{}'), ('${otherOrg}',true,'{"features":{"projectWorkspace":true}}');
  insert into profiles(id,organization_id,active,crm_only,role,name) values ('${founder.id}','${org}',true,false,'ceo','Fundador'),
    ('${executor.id}','${org}',true,false,'colaborador','Equipo'),
    ('${outsider.id}','${otherOrg}',true,false,'admin','Otra organización');
`);
const project = randomUUID();
const id = randomUUID();
const mutate = (actor, action, data) => actor.client.rpc("work_project_action", { p_org: org, p_action: action, p_data: data });
const snapshot = (actor) => actor.client.rpc("work_project_snapshot", { p_org: org });
await checked(mutate(founder, "create_project", { id: project, title: "Piloto", outcome: "Validar publicación" }));
let delivery = await checked(mutate(founder, "create_delivery", {
  id, project_id: project, title: "Validar informe", outcome: "Informe revisado", assignee_id: executor.id,
  reviewer_id: founder.id, executor: "person", criteria: ["Verificar fuentes"], due_on: "2026-11-23",
}));
assert.equal((await checked(snapshot(executor))).deliveries[0].id, id);
assert.equal((await snapshot(outsider)).error?.code, "42501");
delivery = await checked(mutate(executor, "start", { id, version: delivery.version }));
delivery = await checked(mutate(executor, "submit", { id, version: delivery.version, checked: [true], evidence: "Fuentes validadas" }));
assert.equal((await mutate(executor, "approve", { id, version: delivery.version })).error?.code, "42501");
delivery = await checked(mutate(founder, "approve", { id, version: delivery.version }));
assert.equal(delivery.state, "approved");
const anonymous = createClient(api.href, config.ANON_KEY, { auth });
assert.ok((await anonymous.rpc("work_project_snapshot", { p_org: org })).error);
console.log("Supabase de ensayo: autenticación, permisos, evidencias y aprobación comprobados por PostgREST.");

const [dukeOwner, otherSuperadmin, teamMember] = await Promise.all([signIn(), signIn(), signIn()]);
const duke = "00000000-0000-0000-0000-000000000001";
pg(`
  insert into organizations values ('${duke}',true,'{"features":{"projectWorkspace":true}}');
  insert into profiles(id,organization_id,active,crm_only,role,name) values
    ('${dukeOwner.id}','${duke}',true,false,'super_admin','Admin autorizado'),
    ('${otherSuperadmin.id}','${duke}',true,false,'super_admin','Otro admin'),
    ('${teamMember.id}','${duke}',true,false,'asesor','Integrante de Duke');
  insert into work_duke_project_accounts(profile_id) values ('${dukeOwner.id}');
`);
const dukeAccess = (actor) => actor.client.rpc("work_project_duke_access");
assert.equal(await checked(dukeAccess(dukeOwner)), true);
assert.equal(await checked(dukeAccess(otherSuperadmin)), false);
assert.equal(await checked(dukeAccess(founder)), false);
const dukeSnapshot = (actor, deliveryId = null) => actor.client.rpc("work_project_snapshot", { p_org: duke, p_delivery: deliveryId });
const dukeAction = (actor, action, data) => actor.client.rpc("work_project_action", { p_org: duke, p_action: action, p_data: data });
const dukeWorkspace = await checked(dukeSnapshot(dukeOwner));
assert.equal(dukeWorkspace.manage, true);
assert.ok(dukeWorkspace.people.some((person) => person.id === teamMember.id));
assert.equal((await checked(dukeSnapshot(otherSuperadmin))).manage, false);
assert.ok((await otherSuperadmin.client.from("work_duke_project_accounts").insert({ profile_id: otherSuperadmin.id })).error);
assert.ok((await anonymous.rpc("work_project_duke_access")).error);

const dukeProject = randomUUID();
await checked(dukeAction(dukeOwner, "create_project", { id: dukeProject, title: "Proyecto Duke", outcome: "Revisar entregas" }));
await assert.rejects(checked(dukeAction(otherSuperadmin, "create_project",
  { id: randomUUID(), title: "No autorizado", outcome: "Debe rechazarlo" })));
const activity = randomUUID();
const payload = {
  id: activity, project_id: dukeProject, title: "Actividad individual", outcome: "Evidencia lista",
  assignee_id: teamMember.id, reviewer_id: dukeOwner.id, executor: "person", criteria: ["Comprobar fuentes"],
};
await assert.rejects(checked(dukeAction(dukeOwner, "create_delivery", { ...payload, assignee_id: outsider.id })));
let assigned = await checked(dukeAction(dukeOwner, "create_delivery", payload));
assert.equal(assigned.due_on, null);
assert.deepEqual((await checked(dukeSnapshot(teamMember))).deliveries.map((entry) => entry.id), [activity]);
assert.equal((await dukeSnapshot(otherSuperadmin, activity)).error?.code, "42501");
assert.equal((await dukeSnapshot(outsider, activity)).error?.code, "42501");
assert.equal(await checked(dukeAccess(teamMember)), false);
assert.equal(await checked(admin.rpc("work_project_limit_help", { p_org: duke, p_actor: teamMember.id })), false);
assert.equal(await checked(admin.rpc("work_project_limit_help", { p_org: duke, p_actor: dukeOwner.id })), true);
assigned = await checked(dukeAction(teamMember, "start", { id: activity, version: assigned.version }));
assigned = await checked(dukeAction(teamMember, "submit", { id: activity, version: assigned.version, checked: [true], evidence: "Fuentes verificadas" }));
assert.equal((await checked(dukeAction(dukeOwner, "approve", { id: activity, version: assigned.version }))).state, "approved");
const weekRequest = randomUUID();
const applyWeek = (actor, requestId, activities, zone = "America/Tijuana") => actor.client.rpc("work_project_apply_week", {
  p_org: duke, p_request: requestId, p_zone: zone, p_plan: activities,
});
const planned = [
  { project_id:dukeProject, title:"Revisar propuesta", outcome:"Propuesta revisada", assignee_id:teamMember.id,
    reviewer_id:dukeOwner.id, due_on:"2026-11-24", time:"09:00", criteria:["Validar alcance"] },
  { project_id:dukeProject, title:"Cerrar revisión", outcome:"Resultado confirmado", assignee_id:dukeOwner.id,
    reviewer_id:dukeOwner.id, due_on:"2026-11-25", time:"16:00", criteria:["Verificar resultado"] },
];
assert.equal((await applyWeek(teamMember,weekRequest,planned)).error?.code,"42501");
await assert.rejects(checked(applyWeek(dukeOwner,randomUUID(),[planned[0],{...planned[1],assignee_id:outsider.id}])));
assert.ok(!(await checked(dukeSnapshot(dukeOwner))).deliveries.some(item=>item.title===planned[0].title));
const weekReceipt = await checked(applyWeek(dukeOwner,weekRequest,planned));
assert.equal(weekReceipt.created.length,2);
assert.deepEqual(await checked(applyWeek(dukeOwner,weekRequest,planned)),weekReceipt);
assert.equal((await applyWeek(dukeOwner,weekRequest,[planned[0]])).error?.code,"23505");
assert.equal((await checked(applyWeek(dukeOwner,randomUUID(),planned))).reused.length,2);
const [assignedWeek] = (await checked(dukeSnapshot(teamMember))).deliveries.filter(item=>item.title===planned[0].title);
assert.equal(assignedWeek.schedule_zone,"America/Tijuana");
assert.equal(new Date(assignedWeek.scheduled_at).toISOString(),"2026-11-24T17:00:00.000Z");
assert.equal((await dukeSnapshot(otherSuperadmin,weekReceipt.created[0])).error?.code,"42501");
const moved = await checked(dukeAction(dukeOwner,"delegate",{id:assignedWeek.id,version:assignedWeek.version,
  assignee_id:teamMember.id,reviewer_id:dukeOwner.id,executor:"person",due_on:"2026-11-26"}));
assert.equal(new Date(moved.scheduled_at).toISOString(),"2026-11-26T17:00:00.000Z");
console.log("Semana: lote atómico, recibo reproducible, horario local y permisos confirmados.");
pg(`update profiles set role='admin' where id='${dukeOwner.id}';`);
assert.equal(await checked(dukeAccess(dukeOwner)), false);
console.log("Duke: el módulo sigue limitado al superadministrador. Un integrante pudo trabajar su actividad y otro superadministrador quedó excluido.");
