import test from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_CLINICS,
  DEMO_USERS,
  DEMO_PATIENTS,
  DEMO_SECURITY_NOTICE,
  getAccessiblePatients,
  canReadRecord,
  getDemoRecord,
  answerDemoCopilot,
  createDemoNote,
} from "../src/dental-demo/clinical-demo-model.mjs";

const sessionFor = (user) => ({
  userId: user.id,
  role: user.role,
  clinicId: user.clinicId,
});
const doctor = DEMO_USERS.find(
  (user) => user.email === "medico.compleja@example.invalid",
);
const session = sessionFor(doctor);
const assignedId = doctor.recordIds[0],
  sharedId = doctor.recordIds[1];
const sameClinicUnassigned = DEMO_PATIENTS.find(
  (patient) =>
    patient.clinicId === doctor.clinicId &&
    !doctor.recordIds.includes(patient.recordId),
);
const foreign = DEMO_PATIENTS.find(
  (patient) => patient.clinicId !== doctor.clinicId,
);

test("fixtures cover three clinic complexities and remain synthetic immutable examples", () => {
  assert.deepEqual(
    DEMO_CLINICS.map((clinic) => clinic.complexity),
    ["Compleja", "Intermedia", "Simple"],
  );
  assert.equal(
    new Set(DEMO_PATIENTS.map((patient) => patient.recordId)).size,
    DEMO_PATIENTS.length,
  );
  for (const patient of DEMO_PATIENTS) {
    assert.match(patient.name, /^Paciente Demo \d{2}$/);
    assert.match(patient.recordId, /^demo-r-[a-f0-9]{6}$/);
    assert.ok(DEMO_CLINICS.some((clinic) => clinic.id === patient.clinicId));
    assert.ok(!patient.email && !patient.phone);
  }
  assert.ok(
    DEMO_USERS.every(
      (user) => user.email.endsWith("@example.invalid") && !user.password,
    ),
  );
  assert.match(DEMO_SECURITY_NOTICE, /no.*seguridad.*producción/);
  assert.throws(() => {
    doctor.role = "admin";
  }, TypeError);
  assert.throws(() => {
    doctor.recordIds.push(foreign.recordId);
  }, TypeError);
});

test("every role and clinic applies canonical identity, clinic scope and doctor assignment", () => {
  for (const user of DEMO_USERS) {
    const actor = sessionFor(user),
      patients = getAccessiblePatients(actor);
    assert.ok(patients.length);
    assert.ok(patients.every((patient) => patient.clinicId === user.clinicId));
    assert.ok(
      patients.every(
        (patient) => !("summary" in patient) && !("specialty" in patient),
      ),
    );
    for (const patient of DEMO_PATIENTS) {
      const expected =
        user.role === "doctor" &&
        user.clinicId === patient.clinicId &&
        user.recordIds.includes(patient.recordId);
      assert.equal(
        canReadRecord(actor, patient.recordId),
        expected,
        `${user.email} / ${patient.name}`,
      );
      const record = getDemoRecord(actor, patient.recordId);
      assert.equal(!!record, expected);
      if (record) {
        assert.equal(record.demo, true);
        assert.equal(record.patientId, patient.id);
      } else
        assert.throws(
          () => createDemoNote(actor, patient.recordId, "Nota demo"),
          /permiso/,
        );
    }
  }
  const otherDoctor = DEMO_USERS.find(
    (user) => user.email === "medico2.compleja@example.invalid",
  );
  assert.equal(canReadRecord(session, sharedId), true);
  assert.equal(canReadRecord(sessionFor(otherDoctor), sharedId), true);
  assert.equal(canReadRecord(session, sameClinicUnassigned.recordId), false);
  assert.equal(canReadRecord(session, foreign.recordId), false);
});

test("manipulated roles, clinic IDs and user IDs do not grant access", () => {
  const receptionist = DEMO_USERS.find(
    (user) => user.role === "reception" && user.clinicId === doctor.clinicId,
  );
  for (const forged of [
    null,
    {},
    { ...session, role: "admin" },
    { ...session, clinicId: foreign.clinicId },
    { ...session, userId: "missing" },
    { ...sessionFor(receptionist), role: "doctor", recordIds: [assignedId] },
  ]) {
    assert.deepEqual(getAccessiblePatients(forged), []);
    assert.equal(canReadRecord(forged, assignedId), false);
    assert.equal(getDemoRecord(forged, assignedId), null);
    assert.equal(
      answerDemoCopilot("Ver pacientes", { session: forged }).type,
      "unauthorized",
    );
  }
});

test("a record selected through a URL remains denied without assignment or clinic access", () => {
  for (const recordId of [
    sameClinicUnassigned.recordId,
    foreign.recordId,
    "demo-r-ffffff",
    "../private",
  ]) {
    assert.equal(getDemoRecord(session, recordId), null);
    const answer = answerDemoCopilot("resumen del expediente", {
      session,
      recordId,
    });
    assert.equal(answer.type, "denied");
    assert.equal(answer.links, undefined);
    assert.ok(
      !answer.reply.includes(foreign.name) &&
        !answer.reply.includes(sameClinicUnassigned.name),
    );
  }
});

test("Copilot only generates opaque record links within the current physician assignment", () => {
  const answer = answerDemoCopilot("Abrir expedientes", { session });
  assert.equal(answer.type, "records");
  assert.equal(answer.links.length, 2);
  for (const link of answer.links) {
    assert.ok(canReadRecord(session, link.recordId));
    assert.deepEqual(Object.keys(link).sort(), ["label", "recordId"]);
    assert.ok(
      !link.recordId.includes("Paciente") && !link.recordId.includes("@"),
    );
  }
  const one = answerDemoCopilot("Abrir expediente de Paciente Demo 01", {
    session,
  });
  assert.equal(one.type, "records");
  assert.equal(one.links.length, 1);
  assert.equal(one.links[0].recordId, assignedId);
  for (const text of [
    "Abrir expediente de Paciente Demo 03",
    "Ver paciente 04",
    "Abrir expediente de paciente 999",
  ]) {
    const denied = answerDemoCopilot(text, { session });
    assert.equal(denied.type, "denied");
    assert.equal(denied.links, undefined);
  }
  for (const user of DEMO_USERS.filter((user) => user.role !== "doctor")) {
    assert.equal(
      answerDemoCopilot("Abrir expedientes", { session: sessionFor(user) })
        .type,
      "denied",
    );
    assert.equal(
      answerDemoCopilot("Ver pacientes", { session: sessionFor(user) }).links,
      undefined,
    );
  }
});

test("global clinical questions return only assigned record links and never content or note drafts", () => {
  for (const text of [
    "Resumen expediente Paciente Demo 01",
    "Alergias de Paciente Demo 01",
    "Medicamentos del paciente 01",
    "Prepara nota para paciente Demo 01: datos ficticios de prueba",
  ]) {
    const answer = answerDemoCopilot(text, { session });
    assert.equal(answer.type, "records");
    assert.equal(answer.links[0].recordId, assignedId);
    assert.equal(answer.pendingNote, undefined);
    assert.ok(
      !answer.reply.includes("Alergia ficticia registrada") &&
        !answer.reply.includes("Seguimiento sintético de medicina interna") &&
        !answer.reply.includes("datos ficticios de prueba"),
    );
  }
  const otherContext = answerDemoCopilot("Alergias de Paciente Demo 02", {
    session,
    recordId: assignedId,
  });
  assert.equal(otherContext.type, "records");
  assert.equal(otherContext.links[0].recordId, sharedId);
  assert.ok(!otherContext.reply.includes("Sin alergias consignadas"));
  const inside = answerDemoCopilot("Alergias de Paciente Demo 01", {
    session,
    recordId: assignedId,
  });
  assert.equal(inside.type, "record");
  assert.match(inside.reply, /Alergia ficticia registrada/);
});

test("record reads use documented synthetic fields and do not infer advice or diagnoses", () => {
  const context = { session, recordId: assignedId };
  assert.match(
    answerDemoCopilot("Dame el resumen del expediente", context).reply,
    /expediente sintético/,
  );
  assert.match(
    answerDemoCopilot("¿Qué alergias tiene?", context).reply,
    /Alergias registradas/,
  );
  assert.match(
    answerDemoCopilot("¿Qué medicamentos tiene registrados?", context).reply,
    /Sin lista verificada/,
  );
  assert.match(
    answerDemoCopilot("Muéstrame los antecedentes", context).reply,
    /Antecedentes inventados/,
  );
  for (const text of [
    "Diagnostica a este paciente",
    "Prescribe un antibiótico",
    "¿Qué dosis le doy?",
    "Recomiéndame un tratamiento",
    "Interpreta los resultados",
  ]) {
    const answer = answerDemoCopilot(text, context);
    assert.equal(answer.type, "blocked");
    assert.equal(answer.pendingNote, undefined);
  }
});

test("notes are proposals until explicit confirmation and remain unsigned memory drafts", () => {
  const before = getDemoRecord(session, assignedId),
    context = { session, recordId: assignedId };
  const answer = answerDemoCopilot(
    "Prepara nota: revisión de datos ficticios pendiente.",
    context,
  );
  assert.equal(answer.type, "note-proposal");
  assert.deepEqual(answer.pendingNote, {
    recordId: assignedId,
    text: "revisión de datos ficticios pendiente.",
  });
  assert.deepEqual(getDemoRecord(session, assignedId), before);
  const note = createDemoNote(session, assignedId, answer.pendingNote.text);
  assert.equal(note.recordId, assignedId);
  assert.equal(note.author, doctor.name);
  assert.equal(note.status, "Borrador demo sin firma");
  assert.match(note.createdAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(getDemoRecord(session, assignedId), before);
  const withDraft = { ...before, notes: [...before.notes, note] };
  const read = answerDemoCopilot("Ver notas", {
    ...context,
    records: { [assignedId]: withDraft },
  });
  assert.match(read.reply, /revisión de datos ficticios pendiente/);
  assert.match(read.reply, /Borrador demo sin firma/);
  for (const text of ["", " ", "x".repeat(2001), "bad\u0000text", null, {}])
    assert.throws(
      () => createDemoNote(session, assignedId, text),
      /entre 1 y 2000/,
    );
  assert.throws(
    () => createDemoNote(session, foreign.recordId, "Nota"),
    /permiso/,
  );
});

test("mutable record copies and draft overrides cannot replace identity or scope", () => {
  const record = getDemoRecord(session, assignedId);
  record.summary = "modified";
  record.notes.push({ text: "modified" });
  assert.notEqual(getDemoRecord(session, assignedId).summary, "modified");
  assert.equal(getDemoRecord(session, assignedId).notes.length, 1);
  const answer = answerDemoCopilot("Ver notas", {
    session,
    recordId: assignedId,
    records: {
      [assignedId]: {
        id: foreign.recordId,
        clinicId: foreign.clinicId,
        notes: [{ text: "foreign-secret" }],
      },
    },
  });
  assert.ok(!answer.reply.includes("foreign-secret"));
});

test("Copilot states demo scope, no compliance certification, and never calls an external service", () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error("Unexpected network call");
  };
  try {
    assert.match(
      answerDemoCopilot("¿Está conectado a Huli?", { session }).reply,
      /No consulta ni modifica Huli/,
    );
    assert.match(
      answerDemoCopilot("Guía para preparar una auditoría COFEPRIS", {
        session,
      }).reply,
      /no acredita cumplimiento ni certificación/,
    );
    assert.equal(answerDemoCopilot("NOM-013", { session }).type, "guidance");
    assert.match(
      answerDemoCopilot("Ver agenda de hoy", { session }).reply,
      /no corresponden a la fecha actual/,
    );
    assert.equal(
      answerDemoCopilot("agenda una cita y envía WhatsApp", { session }).type,
      "scope",
    );
    assert.equal(
      answerDemoCopilot("¿Qué puedes hacer?", { session }).type,
      "help",
    );
    for (const input of [null, "", "x".repeat(2001), "bad\u0000text"])
      assert.equal(answerDemoCopilot(input, { session }).type, "error");
  } finally {
    globalThis.fetch = previousFetch;
  }
});
