import assert from "node:assert/strict";
import test from "node:test";
import {
  buildClinicalReadiness,
  clinicalReadinessText,
  verifiedClinicalRelease,
} from "../src/dental-demo/clinical-readiness.mjs";

const release = {
  project: "stratos-ai-application",
  projectId: "prj_Epv30SFnQmJGnxy3LdYLKV8NwDLi",
  repository: "iagents00/stratos-ai-application",
  commit: "a".repeat(40),
  builtAt: "2026-10-16T12:00:00.000Z",
  dirty: false,
};
const metadata = {
  authenticated: true,
  mode: "read-only",
  verification: {
    status: 200,
    requestId: "6c5cf32a-3db4-477d-bbed-26d90231bc9a",
    checkedAt: "2026-10-16T12:30:00.000Z",
  },
};

test("readiness separates a verified query from unverified regulatory documents", () => {
  const report = buildClinicalReadiness(metadata, release);
  assert.equal(report.technicalChecks.authenticatedHuliConnection, true);
  assert.equal(report.technicalChecks.identifiedRelease, true);
  assert.ok(
    report.pendingDocuments.every(
      (item) => item.verifiedAt === null && /Pendiente/.test(item.status),
    ),
  );
  assert.match(report.notice, /no es un certificado/);
});
test("readiness export excludes unexpected metadata, patient data and credentials", () => {
  const report = buildClinicalReadiness(
    {
      ...metadata,
      apiKey: "SENSITIVE-API-KEY",
      patients: [{ name: "SENSITIVE-PATIENT" }],
      doctors: [{ name: "SENSITIVE-PROFESSIONAL" }],
      access_token: "SENSITIVE-TOKEN",
      verification: {
        ...metadata.verification,
        password: "SENSITIVE-PASSWORD",
      },
    },
    release,
  );
  assert.doesNotMatch(
    JSON.stringify(report) + clinicalReadinessText(report),
    /SENSITIVE/,
  );
});
test("connection and release are pending without actual technical references", () => {
  assert.equal(
    buildClinicalReadiness({ authenticated: true, mode: "read-only" }, release)
      .technicalChecks.authenticatedHuliConnection,
    false,
  );
  assert.equal(
    verifiedClinicalRelease({ ...release, projectId: "other" }),
    null,
  );
  assert.equal(
    verifiedClinicalRelease({ ...release, repository: "other" }),
    null,
  );
  assert.equal(verifiedClinicalRelease({ ...release, dirty: true }), null);
  assert.equal(
    verifiedClinicalRelease({ ...release, commit: "preview" }),
    null,
  );
  assert.equal(
    verifiedClinicalRelease({ ...release, builtAt: "invalid" }),
    null,
  );
  assert.equal(
    buildClinicalReadiness(metadata, null).technicalChecks.identifiedRelease,
    false,
  );
});
test("demo report describes simulation and future requirements without claiming live Huli access", () => {
  const report = buildClinicalReadiness(
    { mode: "demo", patients: [{ name: "SENSITIVE-PATIENT" }] },
    release,
  );
  assert.equal(report.simulation, true);
  assert.equal(report.technicalChecks.authenticatedHuliConnection, false);
  assert.match(report.notice, /permisos simulados/);
  assert.match(report.clinicalRecord, /Antes de una versión real/);
  assert.ok(
    report.pendingDocuments.every((item) =>
      /Antes de una versión real/.test(item.status),
    ),
  );
  assert.doesNotMatch(
    clinicalReadinessText(report),
    /una cuenta administradora|SENSITIVE-PATIENT/,
  );
});

test("timestamps reject comments, impossible dates and private content instead of exporting raw values", () => {
  for (const timestamp of [
    "2026-10-16 (SENSITIVE-PATIENT)",
    "2026-10-16T12:30:00.000Z SENSITIVE-TOKEN",
    "2026-02-30T12:30:00.000Z",
    "2026-10-16T12:30:00.000+00:00",
  ]) {
    assert.equal(
      verifiedClinicalRelease({ ...release, builtAt: timestamp }),
      null,
    );
    const report = buildClinicalReadiness(
      {
        ...metadata,
        verification: { ...metadata.verification, checkedAt: timestamp },
      },
      release,
    );
    assert.equal(report.technicalChecks.authenticatedHuliConnection, false);
    assert.equal(report.technicalChecks.checkedAt, undefined);
    assert.doesNotMatch(
      JSON.stringify(report) + clinicalReadinessText(report),
      /SENSITIVE/,
    );
  }
  assert.equal(
    verifiedClinicalRelease({ ...release, builtAt: "2026-10-16T12:00:00Z" })
      .builtAt,
    release.builtAt,
  );
});

test("demo TXT and JSON contain the same public matrix and distinguish provider sources", () => {
  const report = buildClinicalReadiness(
    {
      mode: "demo",
      scenario: "demo-clinic-dental",
      patient: "SENSITIVE-PATIENT",
      prompt: "SENSITIVE-PROMPT",
      notes: ["SENSITIVE-NOTE"],
      password: "SENSITIVE-PASSWORD",
      audit: { officialApproval: true, scenario: "SENSITIVE-PATIENT" },
    },
    { ...release, patient: "SENSITIVE-PATIENT" },
    new Date("2026-10-16T12:00:00Z"),
  );
  const txt = clinicalReadinessText(report);
  assert.equal(report.schemaVersion, 2);
  assert.equal(report.audit.scenario.id, "demo-clinic-dental");
  assert.equal(report.audit.officialApproval, false);
  assert.equal(report.audit.realClinicalUseEnabled, false);
  assert.match(txt, /BLOQUEOS PARA USAR EXPEDIENTES REALES/);
  for (const norm of report.audit.standards) assert.ok(txt.includes(norm.name));
  assert.match(txt, /Guía del proveedor · Huli/);
  assert.match(txt, /Fuente oficial · NOM-005/);
  assert.ok(
    report.sources.some((item) => /versión 29, folio 019/.test(item.label)),
  );
  assert.ok(
    report.sources.some((item) => /versión 30, folio 020/.test(item.label)),
  );
  assert.doesNotMatch(JSON.stringify(report) + txt, /SENSITIVE/);
  assert.equal(buildClinicalReadiness(metadata, release).audit, null);
});
