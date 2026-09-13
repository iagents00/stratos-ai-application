/** Isolated PostgreSQL engine with synthetic identities. Never connects to production. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const { PGlite } = await import(
  process.env.STRATOS_PGLITE_MODULE || "@electric-sql/pglite"
);
const db = new PGlite();
const org1 = "10000000-0000-0000-0000-000000000001",
  org2 = "10000000-0000-0000-0000-000000000002";
const admin = "20000000-0000-0000-0000-000000000001",
  seller = "20000000-0000-0000-0000-000000000002",
  other = "20000000-0000-0000-0000-000000000003";
const lead1 = "30000000-0000-0000-0000-000000000001",
  lead2 = "30000000-0000-0000-0000-000000000002";
let passed = 0;
const ok = (m) => {
  passed++;
  console.log(`✓ ${m}`);
};
try {
  await db.exec(`
 CREATE ROLE authenticated; CREATE ROLE anon;
 CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('request.jwt.claim.role',true) $$;
 GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
 CREATE TABLE organizations(id uuid PRIMARY KEY,meta_config jsonb);
 CREATE TABLE profiles(id uuid PRIMARY KEY,organization_id uuid,name text,role text);
 CREATE TABLE leads(id uuid PRIMARY KEY,organization_id uuid,asesor_id uuid,asesor_name text,deleted_at timestamptz,opt_out boolean default false);
 CREATE TABLE agenda_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid,asesor_id uuid,asesor_name text,lead_id uuid,fecha date,tipo text,canal text,razon text,pedir text,estado text,resultado text,completado_at timestamptz);
 CREATE UNIQUE INDEX agenda_items_lead_dia ON agenda_items(lead_id,fecha) WHERE lead_id IS NOT NULL;
 CREATE FUNCTION is_admin_or_above() RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role IN ('admin','super_admin')) $$;
 CREATE FUNCTION can_view_all_leads() RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
 INSERT INTO organizations VALUES('${org1}','{"rails":{"activo":false},"plan":"pro"}'),('${org2}','{"rails":{"activo":false}}');
 INSERT INTO profiles VALUES('${admin}','${org1}','Admin','admin'),('${seller}','${org1}','Seller','asesor'),('${other}','${org2}','Other','admin');
 INSERT INTO leads(id,organization_id,asesor_id,asesor_name) VALUES('${lead1}','${org1}','${seller}','Seller'),('${lead2}','${org2}','${other}','Other');
 GRANT SELECT ON profiles,leads,organizations,agenda_items TO authenticated;
 -- Deliberately permissive starting grants: the new guard must resist direct requests too.
 GRANT UPDATE ON organizations TO authenticated;
 GRANT INSERT,UPDATE,DELETE ON agenda_items TO authenticated;
 `);
  await db.exec(
    readFileSync(
      new URL(
        "../../supabase/migrations/243_rails_gobierno_y_agenda_segura.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  ok("Migration compiles against PostgreSQL and applies atomically");
  const as = async (id) => {
    await db.exec(
      `RESET ROLE; SELECT set_config('request.jwt.claim.sub','${id}',false); SELECT set_config('request.jwt.claim.role','authenticated',false); SET ROLE authenticated;`,
    );
  };
  await as(seller);
  await assert.rejects(
    db.exec(
      `UPDATE organizations SET meta_config='{"rails":{"activo":true}}' WHERE id='${org1}'`,
    ),
    /administrador/,
  );
  ok("Seller cannot modify Rails even with a permissive UPDATE grant");
  await as(other);
  await assert.rejects(
    db.exec(
      `UPDATE organizations SET meta_config='{"rails":{"activo":true}}' WHERE id='${org1}'`,
    ),
    /administrador/,
  );
  ok("Admin from another organization cannot change the process");
  await as(admin);
  await db.exec(
    `UPDATE organizations SET meta_config=jsonb_set(meta_config,'{rails}','{"activo":true}') WHERE id='${org1}'`,
  );
  assert.equal(
    (await db.query("SELECT count(*)::int n FROM rails_config_history")).rows[0]
      .n,
    1,
  );
  ok("Own-org admin can publish and creates one audit version");
  await assert.rejects(
    db.exec("DELETE FROM rails_config_history"),
    /permission denied/,
  );
  ok("History cannot be deleted by the application admin");
  await as(seller);
  assert.equal(
    (await db.query("SELECT * FROM rails_config_history")).rows.length,
    0,
  );
  ok("Seller cannot read configuration history");
  await assert.rejects(
    db.exec(
      `INSERT INTO agenda_items(lead_id,fecha) VALUES('${lead1}',CURRENT_DATE)`,
    ),
    /permission denied/,
  );
  ok("Direct agenda writes denied");
  const call = (id) =>
    db.query(
      `SELECT public.rails_marcar_accion('${id}','primer_contacto','Prueba','hecho',null,'llamada','Resultado')`,
    );
  await call(lead1);
  await call(lead1);
  assert.equal(
    (await db.query("SELECT count(*)::int n FROM agenda_items")).rows[0].n,
    1,
  );
  ok("Authorized result survives repeat requests without duplicates");
  await assert.rejects(call(lead2), /No tienes acceso/);
  ok("Cross-organization agenda write denied");
  await db.exec(
    `RESET ROLE; UPDATE leads SET asesor_id='${admin}',asesor_name='Admin' WHERE id='${lead1}'; SET ROLE authenticated;`,
  );
  await assert.rejects(call(lead1), /No tienes acceso/);
  ok("Same-org unassigned seller cannot overwrite another advisor result");
  await as(admin);
  await db.exec(
    `RESET ROLE; UPDATE leads SET opt_out=true WHERE id='${lead1}'; SET ROLE authenticated;`,
  );
  await assert.rejects(call(lead1), /No tienes acceso/);
  ok("Opt-out denies actions even for admin");
  await db.exec(
    `RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false); SET ROLE anon;`,
  );
  await assert.rejects(call(lead1), /permission denied/);
  ok("Anonymous execution denied");
  console.log(
    `${passed} PostgreSQL checks passed. Remote policy drift and n8n compatibility still require staging verification.`,
  );
} finally {
  await db.close();
}
