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
  observeClinicalDemoSession,
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

function lifecycleFixture() {
  let timestamp = 1000;
  const user = DEMO_USERS.find((candidate) => candidate.role === "doctor");
  let session = signInClinicalDemo(
    user.email,
    DEMO_ACCESS_PASSWORD,
    user.clinicId,
    timestamp,
  ).session;
  const activityTarget = new EventTarget();
  const windowTarget = new EventTarget();
  const documentTarget = new EventTarget();
  documentTarget.visibilityState = "visible";
  const timers = new Map();
  let nextTimer = 0;
  let expirations = 0;
  let activities = 0;
  const cleanup = observeClinicalDemoSession({
    getSession: () => session,
    onExpire: () => {
      expirations += 1;
      session = null;
    },
    onActivity: (next) => {
      activities += 1;
      session = next;
    },
    activityTarget,
    windowTarget,
    documentTarget,
    now: () => timestamp,
    setTimer: (callback, delay) => {
      const id = ++nextTimer;
      timers.set(id, { callback, at: timestamp + delay });
      return id;
    },
    clearTimer: (id) => timers.delete(id),
  });
  return {
    activityTarget,
    windowTarget,
    documentTarget,
    cleanup,
    session: () => session,
    expirations: () => expirations,
    activities: () => activities,
    timerCount: () => timers.size,
    setTime(value, runTimers = false) {
      timestamp = value;
      if (runTimers)
        for (const [id, timer] of [...timers])
          if (timer.at <= timestamp) {
            timers.delete(id);
            timer.callback();
          }
    },
    dispatch(target, event) {
      target.dispatchEvent(new Event(event));
    },
  };
}

test("returning to a suspended tab expires once without renewing its session", () => {
  for (const [target, event] of [
    ["windowTarget", "focus"],
    ["windowTarget", "pageshow"],
    ["documentTarget", "visibilitychange"],
  ]) {
    const fixture = lifecycleFixture();
    // Browser timers did not run while this tab was suspended.
    fixture.setTime(1000 + DEMO_IDLE_MS);
    fixture.dispatch(fixture[target], event);
    assert.equal(fixture.session(), null, event);
    assert.equal(fixture.expirations(), 1, event);
    assert.equal(fixture.activities(), 0, event);
    fixture.dispatch(fixture.windowTarget, "focus");
    fixture.dispatch(fixture.activityTarget, "pointerdown");
    assert.equal(fixture.expirations(), 1);
    assert.equal(fixture.timerCount(), 0);
    fixture.cleanup();
  }
});

test("focus and visibility checks preserve an active session's original idle deadline", () => {
  const fixture = lifecycleFixture();
  fixture.setTime(11000);
  fixture.dispatch(fixture.windowTarget, "focus");
  fixture.dispatch(fixture.windowTarget, "pageshow");
  fixture.dispatch(fixture.documentTarget, "visibilitychange");
  assert.equal(fixture.session().lastActivityAt, 1000);
  assert.equal(fixture.activities(), 0);
  fixture.setTime(1000 + DEMO_IDLE_MS, true);
  assert.equal(fixture.session(), null);
  assert.equal(fixture.expirations(), 1);
  fixture.cleanup();
});

test("reading with scroll, wheel and touch renews activity while updates are throttled", () => {
  for (const event of [
    "keydown",
    "pointerdown",
    "wheel",
    "scroll",
    "touchstart",
    "touchmove",
  ]) {
    const fixture = lifecycleFixture();
    fixture.setTime(6000);
    fixture.dispatch(fixture.activityTarget, event);
    assert.equal(fixture.session().lastActivityAt, 6000, event);
    assert.equal(fixture.activities(), 1);
    fixture.setTime(7000);
    fixture.dispatch(fixture.activityTarget, event);
    assert.equal(fixture.activities(), 1);
    assert.equal(fixture.session().lastActivityAt, 6000);
    fixture.setTime(1000 + DEMO_IDLE_MS, true);
    assert.ok(
      fixture.session(),
      "old deadline no longer expires an active reader",
    );
    fixture.setTime(6000 + DEMO_IDLE_MS, true);
    assert.equal(fixture.session(), null);
    assert.equal(fixture.expirations(), 1);
    fixture.cleanup();
  }
});

test("hidden-tab events and late activity cannot keep an expired session alive", () => {
  const fixture = lifecycleFixture();
  fixture.documentTarget.visibilityState = "hidden";
  fixture.setTime(6000);
  fixture.dispatch(fixture.activityTarget, "scroll");
  assert.equal(fixture.activities(), 0);
  fixture.documentTarget.visibilityState = "visible";
  fixture.setTime(1000 + DEMO_IDLE_MS);
  fixture.dispatch(fixture.activityTarget, "keydown");
  assert.equal(fixture.session(), null);
  assert.equal(fixture.activities(), 0);
  assert.equal(fixture.expirations(), 1);
  fixture.cleanup();
});

test("lifecycle teardown removes timers and listeners; invalid clock values fail closed", () => {
  const fixture = lifecycleFixture();
  fixture.cleanup();
  assert.equal(fixture.timerCount(), 0);
  fixture.setTime(1000 + DEMO_IDLE_MS);
  fixture.dispatch(fixture.windowTarget, "focus");
  fixture.dispatch(fixture.activityTarget, "wheel");
  assert.equal(fixture.expirations(), 0);
  assert.equal(fixture.activities(), 0);
  const { session } = signInClinicalDemo(
    DEMO_USERS[0].email,
    DEMO_ACCESS_PASSWORD,
    DEMO_USERS[0].clinicId,
    1000,
  );
  for (const timestamp of [999, Infinity, NaN, "1001"])
    assert.equal(isClinicalDemoSessionActive(session, timestamp), false);
  const backwards = lifecycleFixture();
  backwards.setTime(999);
  backwards.dispatch(backwards.windowTarget, "pageshow");
  assert.equal(backwards.session(), null);
  backwards.cleanup();
});
