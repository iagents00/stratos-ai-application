import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_USERS } from "../src/dental-demo/clinical-demo-model.mjs";
import {
  DEMO_ACCESS_PASSWORD,
  DEMO_IDLE_MS,
  signInClinicalDemo,
  isClinicalDemoSessionActive,
  touchClinicalDemoSession,
  requestedDemoRecord,
  clinicalDemoRecordHref,
} from "../src/dental-demo/clinical-demo-session.mjs";

test("demo login requires the selected clinic account and public demo password", () => {
  const user = DEMO_USERS[0];
  assert.equal(
    signInClinicalDemo(user.email, "incorrect", user.clinicId, 1000).session,
    null,
  );
  assert.equal(
    signInClinicalDemo(user.email, DEMO_ACCESS_PASSWORD, "other-clinic", 1000)
      .session,
    null,
  );
  const result = signInClinicalDemo(
    user.email.toUpperCase(),
    DEMO_ACCESS_PASSWORD,
    user.clinicId,
    1000,
  );
  assert.ok(isClinicalDemoSessionActive(result.session, 1001));
  assert.equal(
    isClinicalDemoSessionActive(
      { ...result.session, role: "forged-role" },
      1001,
    ),
    false,
  );
});
test("idle expiry cannot be extended after the session expired", () => {
  const user = DEMO_USERS[0];
  const { session } = signInClinicalDemo(
    user.email,
    DEMO_ACCESS_PASSWORD,
    user.clinicId,
    1000,
  );
  assert.equal(
    isClinicalDemoSessionActive(session, 1000 + DEMO_IDLE_MS),
    false,
  );
  assert.equal(touchClinicalDemoSession(session, 1000 + DEMO_IDLE_MS), null);
  assert.equal(touchClinicalDemoSession(session, 1100).lastActivityAt, 1100);
});
test("demo record links carry an opaque reference without identity or session", () => {
  const href = clinicalDemoRecordHref("demo-r-abc123");
  assert.equal(href, "/clinica-dental-demo?record=demo-r-abc123");
  assert.equal(
    requestedDemoRecord(new URL(href, "https://example.invalid").search),
    "demo-r-abc123",
  );
  assert.equal(requestedDemoRecord("?record=%3Cscript%3E"), null);
  assert.throws(() => clinicalDemoRecordHref("name@example.com"));
});
