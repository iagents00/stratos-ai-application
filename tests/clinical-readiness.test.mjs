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
