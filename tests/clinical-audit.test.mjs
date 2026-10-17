import assert from "node:assert/strict";
import test from "node:test";
import { buildClinicalAudit } from "../src/dental-demo/clinical-audit.mjs";

test("audit conditions requirements on each scenario without declaring conformity", () => {
  for (const id of [
    "demo-clinic-simple",
    "demo-clinic-dental",
    "demo-clinic-complex",
  ]) {
    const audit = buildClinicalAudit(id);
    assert.equal(audit.scenario.id, id);
    assert.equal(audit.officialApproval, false);
    assert.equal(audit.realClinicalUseEnabled, false);
    assert.match(audit.notice, /no es una visita/);
    assert.deepEqual(
      audit.standards.map((item) => item.id),
      ["nom004", "nom013", "nom024", "nom005", "nom016", "nom087", "nom229"],
    );
    assert.ok(
      audit.standards.every(
        (item) =>
          item.clauses &&
          item.evidence &&
          item.finding &&
          item.status === "No acreditado para un establecimiento real",
      ),
    );
    assert.ok(
      audit.realUseBlockers.every(
        (item) =>
          item.verifiedAt === null &&
          item.responsible === "Por designar" &&
          item.status === "Pendiente de evidencia",
      ),
    );
  }
  assert.match(
    buildClinicalAudit("demo-clinic-dental").standards.find(
      (item) => item.id === "nom013",
    ).applicability,
    /Revisar para atención odontológica/,
  );
  assert.match(
    buildClinicalAudit("demo-clinic-simple").standards.find(
      (item) => item.id === "nom013",
    ).applicability,
    /Condicionada/,
  );
  assert.match(
    buildClinicalAudit("demo-clinic-complex").standards.find(
      (item) => item.id === "nom016",
    ).applicability,
    /hospital no evaluado/,
  );
});

test("unknown or hostile scenario metadata cannot supply scope or exemptions", () => {
  for (const scenario of [
    undefined,
    "__proto__",
    "constructor",
    "SENSITIVE-PATIENT",
    { name: "SENSITIVE-PATIENT", officialApproval: true },
  ]) {
    const audit = buildClinicalAudit(scenario);
    assert.equal(audit.scenario.id, null);
    assert.match(audit.scenario.services, /no se excluye/);
    assert.doesNotMatch(JSON.stringify(audit), /SENSITIVE/);
  }
});

test("separate reports cannot mutate subsequent audit criteria", () => {
  const first = buildClinicalAudit("demo-clinic-dental");
  first.scenario.name = "changed";
  first.standards[0].status = "Conforme";
  first.realUseBlockers[0].verifiedAt = "invented";
  const next = buildClinicalAudit("demo-clinic-dental");
  assert.notEqual(next.scenario.name, "changed");
  assert.notEqual(next.standards[0].status, "Conforme");
  assert.equal(next.realUseBlockers[0].verifiedAt, null);
});
