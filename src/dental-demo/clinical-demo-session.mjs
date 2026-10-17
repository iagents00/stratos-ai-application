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
