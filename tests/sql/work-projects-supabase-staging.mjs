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
  insert into profiles values ('${founder.id}','${org}',true,false,'ceo','Fundador'),
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
