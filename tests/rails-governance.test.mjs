import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
const vite = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});
test.after(() => vite.close());
const { crearRailsStore, vistaPreviaRails } = await vite.ssrLoadModule(
  "/src/lib/rails-store.js",
);
const { fusionarRails } = await vite.ssrLoadModule("/src/lib/rails-config.js");
const { proximaAccion, listaDelDia } = await vite.ssrLoadModule(
  "/src/lib/next-action-engine.js",
);
function fakeClient(initial) {
  let meta = structuredClone(initial),
    fail = false,
    writes = 0,
    beforeUpdate;
  return {
    get meta() {
      return meta;
    },
    set meta(v) {
      meta = v;
    },
    set fail(v) {
      fail = v;
    },
    get writes() {
      return writes;
    },
    set beforeUpdate(v) {
      beforeUpdate = v;
    },
    from() {
      let update, expected;
      return {
        select() {
          return this;
        },
        eq(k, v) {
          if (k === "meta_config") expected = v;
          return this;
        },
        is(k, v) {
          if (k === "meta_config") expected = v;
          return this;
        },
        abortSignal() {
          return this;
        },
        update(p) {
          update = p;
          return this;
        },
        async maybeSingle() {
          if (fail) return { data: null, error: { message: "offline" } };
          if (update) {
            writes++;
            beforeUpdate?.();
            if ((meta == null ? null : JSON.stringify(meta)) !== expected)
              return { data: null, error: null };
            meta = update.meta_config;
          }
          return { data: { meta_config: structuredClone(meta) }, error: null };
        },
      };
    },
  };
}
const admin = { id: "admin1", organizationId: "org1", role: "admin" };
test("seller cannot preview overrides or publish even when calling the store directly", async () => {
  for (const role of ["asesor", "ceo", "director", undefined]) {
    assert.equal(vistaPreviaRails({ role }, "?rails=0"), null);
    const client = fakeClient({ rails: { activo: true } });
    const store = crearRailsStore(client, { ...admin, role });
    await store.load();
    assert.equal(
      (await store.save(fusionarRails({ activo: false }))).ok,
      false,
    );
    assert.equal(client.writes, 0);
  }
  assert.equal(vistaPreviaRails(admin, "?rails=0"), false);
  assert.equal(vistaPreviaRails(admin, "?rails=1"), true);
});
test("failed save retains confirmed config; successful save preserves other organization metadata", async () => {
  const client = fakeClient({
    rails: { activo: false },
    brand: { title: "Original" },
    plan: "pro",
  });
  const store = crearRailsStore(client, admin);
  await store.load();
  client.fail = true;
  assert.equal((await store.save(fusionarRails({ activo: true }))).ok, false);
  assert.equal(store.getSnapshot().cfg.activo, false);
  client.fail = false;
  assert.equal((await store.save(fusionarRails({ activo: true }))).ok, true);
  assert.deepEqual(client.meta.brand, { title: "Original" });
  assert.equal(client.meta.plan, "pro");
});
test("stale admin draft and concurrent metadata changes never overwrite the other writer", async () => {
  const client = fakeClient({ rails: { activo: false }, plan: "pro" });
  const store = crearRailsStore(client, admin);
  await store.load();
  const base = store.getSnapshot().cfg;
  client.meta = { rails: { activo: true }, plan: "pro" };
  assert.equal(
    (await store.save(fusionarRails({ maxTarjetas: 2 }), base)).ok,
    false,
  );
  assert.equal(client.writes, 0);
  await store.load();
  client.beforeUpdate = () => {
    client.meta = { ...client.meta, plan: "enterprise" };
  };
  assert.equal((await store.save(fusionarRails({ activo: false }))).ok, false);
  assert.equal(client.meta.plan, "enterprise");
  assert.equal(client.meta.rails.activo, true);
});
test("late responses from another organization cannot replace the current store", async () => {
  const a = fakeClient({ rails: { activo: true, maxTarjetas: 2 } }),
    b = fakeClient({ rails: { activo: false, maxTarjetas: 9 } });
  const sa = crearRailsStore(a, admin),
    sb = crearRailsStore(b, { ...admin, organizationId: "org2" });
  await Promise.all([sa.load(), sb.load()]);
  assert.equal(sa.getSnapshot().cfg.maxTarjetas, 2);
  assert.equal(sb.getSnapshot().cfg.maxTarjetas, 9);
  a.fail = true;
  await sa.load();
  assert.equal(sa.getSnapshot().cfg.activo, true);
  assert.ok(sa.getSnapshot().error);
  assert.equal(sb.getSnapshot().error, null);
});
test("opt-out, deletion and future promises always override contact recommendations", () => {
  const now = new Date("2026-09-13T12:00:00Z");
  const lead = { id: "a", n: "Example", st: "Contáctame Ya", hot: true };
  assert.ok(proximaAccion(lead, now));
  for (const patch of [
    { opt_out: true },
    { deleted_at: now.toISOString() },
    { next_action_at: "2026-09-20T12:00:00Z" },
    { st: "Cierre" },
  ])
    assert.equal(proximaAccion({ ...lead, ...patch }, now), null);
  assert.equal(
    listaDelDia([lead, { ...lead, id: "b", opt_out: true }], { ahora: now })
      .total,
    1,
  );
  assert.equal(
    fusionarRails({ reglas: { definir_paso: { activa: false } } }).reglas
      .definir_paso.activa,
    true,
  );
  assert.equal(
    proximaAccion(
      { ...lead, st: "Prospecto", next_action_at: "2026-09-10T12:00:00Z" },
      now,
    ).tipo,
    "lead_caliente",
  );
});
test("agenda read failure is visible; failed writes are not acknowledged", async () => {
  const { supabase } = await vite.ssrLoadModule("/src/lib/supabase.js");
  const old = supabase.rpc;
  try {
    const { agendaDeHoy, marcarAccion } =
      await vite.ssrLoadModule("/src/lib/agenda.js");
    supabase.rpc = () => ({
      abortSignal: async () => ({
        data: null,
        error: { message: "permission denied" },
      }),
    });
    await assert.rejects(agendaDeHoy());
    assert.equal(await marcarAccion({ leadId: "a" }, "hecho"), false);
    supabase.rpc = () => ({
      abortSignal: async () => ({
        data: [{ lead_id: "a", estado: "hecho" }],
        error: null,
      }),
    });
    assert.deepEqual(await agendaDeHoy(), { a: "hecho" });
    assert.equal(await marcarAccion({ leadId: "a" }, "hecho"), true);
  } finally {
    supabase.rpc = old;
  }
});
