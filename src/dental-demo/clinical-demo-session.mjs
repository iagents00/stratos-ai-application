import { DEMO_USERS } from "./clinical-demo-model.mjs";

// Public training credentials, intentionally unrelated to Stratos/Huli Auth.
// This client-side simulation must never be used to protect real records.
export const DEMO_ACCESS_PASSWORD = "DemoClinica2026!";
export const DEMO_IDLE_MS = 15 * 60 * 1000;

export function signInClinicalDemo(
  email,
  password,
  clinicId,
  now = Date.now(),
) {
  const user = DEMO_USERS.find(
    (item) =>
      item.email.toLowerCase() === String(email).trim().toLowerCase() &&
      item.clinicId === clinicId,
  );
  if (!user || password !== DEMO_ACCESS_PASSWORD)
    return {
      session: null,
      error:
        "La cuenta o contraseña demo no coincide. Usa una de las cuentas de ejemplo de esta clínica.",
    };
  return {
    session: {
      userId: user.id,
      role: user.role,
      clinicId: user.clinicId,
      lastActivityAt: now,
    },
    error: null,
  };
}

export function isClinicalDemoSessionActive(session, now = Date.now()) {
  return (
    !!session &&
    Number.isFinite(now) &&
    Number.isFinite(session.lastActivityAt) &&
    now >= session.lastActivityAt &&
    now - session.lastActivityAt < DEMO_IDLE_MS &&
    DEMO_USERS.some(
      (user) =>
        user.id === session.userId &&
        user.role === session.role &&
        user.clinicId === session.clinicId,
    )
  );
}

export function touchClinicalDemoSession(session, now = Date.now()) {
  return isClinicalDemoSessionActive(session, now)
    ? { ...session, lastActivityAt: now }
    : null;
}

// This lifecycle still only governs synthetic demo state. Resuming a suspended
// tab checks expiry without treating focus or visibility as renewed activity.
// Injected targets and clock let tests exercise browser suspension deterministically.
export function observeClinicalDemoSession({
  getSession,
  onExpire,
  onActivity,
  activityTarget,
  windowTarget,
  documentTarget,
  now = Date.now,
  setTimer = globalThis.setTimeout,
  clearTimer = globalThis.clearTimeout,
  throttleMs = 5000,
}) {
  let timer;
  let stopped = false;
  let expired = false;
  function validate() {
    if (stopped || expired) return false;
    const session = getSession();
    if (!session) return false;
    if (isClinicalDemoSessionActive(session, now())) return true;
    expired = true;
    clearTimer(timer);
    onExpire();
    return false;
  }
  function schedule() {
    clearTimer(timer);
    if (!validate()) return;
    timer = setTimer(
      () => {
        if (validate()) schedule();
      },
      Math.max(0, getSession().lastActivityAt + DEMO_IDLE_MS - now()),
    );
  }
  function resume() {
    if (validate()) schedule();
  }
  function activity() {
    if (documentTarget?.visibilityState === "hidden" || !validate()) return;
    const session = getSession();
    const timestamp = now();
    if (timestamp - session.lastActivityAt >= throttleMs) {
      const nextSession = touchClinicalDemoSession(session, timestamp);
      if (nextSession) {
        onActivity(nextSession);
        schedule();
      }
    }
  }
  const activities = [
    "keydown",
    "pointerdown",
    "wheel",
    "scroll",
    "touchstart",
    "touchmove",
  ];
  const options = { capture: true, passive: true };
  for (const event of activities)
    activityTarget?.addEventListener(event, activity, options);
  windowTarget?.addEventListener("focus", resume);
  windowTarget?.addEventListener("pageshow", resume);
  documentTarget?.addEventListener("visibilitychange", resume);
  schedule();
  return () => {
    stopped = true;
    clearTimer(timer);
    for (const event of activities)
      activityTarget?.removeEventListener(event, activity, options);
    windowTarget?.removeEventListener("focus", resume);
    windowTarget?.removeEventListener("pageshow", resume);
    documentTarget?.removeEventListener("visibilitychange", resume);
  };
}

export function requestedDemoRecord(search) {
  const params = new URLSearchParams(search);
  const id = params.get("record");
  return id && /^[a-zA-Z0-9-]{1,80}$/.test(id) ? id : null;
}

export function clinicalDemoRecordHref(recordId) {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(recordId || ""))
    throw new Error("Referencia de expediente demo inválida.");
  return `/clinica-dental-demo?record=${encodeURIComponent(recordId)}`;
}
