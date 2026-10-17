// Every fixture is invented. These browser-side checks illustrate a workflow;
// they are not authentication, authorization or a security boundary for production.
export const DEMO_SECURITY_NOTICE =
  "Simulación con datos sintéticos. Estos permisos locales no constituyen una barrera de seguridad para producción; una implementación real requiere autenticación y autorización verificadas en el servidor.";
export const DEMO_MAX_DRAFTS = 20;
export const DEMO_MAX_RECORD_REPLY = 10000;
export const DEMO_DRAFT_STATUS = "Borrador demo sin firma";
const INVALID_NOTE_CONTROLS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
export const DEMO_CLINICS = [
  {
    id: "demo-clinic-complex",
    name: "Centro Multiespecialidad · Demo",
    complexity: "Compleja",
    description:
      "Varias especialidades, profesionales y seguimiento compartido con asignación explícita.",
  },
  {
    id: "demo-clinic-dental",
    name: "Clínica Dental · Demo",
    complexity: "Intermedia",
    description:
      "Agenda odontológica, recepción y expedientes asignados a un profesional.",
  },
  {
    id: "demo-clinic-simple",
    name: "Consulta General · Demo",
    complexity: "Simple",
    description: "Un consultorio, agenda diaria y seguimiento clínico básico.",
  },
];

const RECORD_IDS = [
  "demo-r-f41a8c",
  "demo-r-b73e2d",
  "demo-r-c96f5a",
  "demo-r-a28d7b",
  "demo-r-e64c3f",
  "demo-r-d85b1e",
  "demo-r-a59f6c",
];
export const DEMO_USERS = [
  {
    id: "demo-u-713b",
    email: "admin.compleja@example.invalid",
    name: "Administración Multiespecialidad · Demo",
    role: "admin",
    clinicId: "demo-clinic-complex",
    clinicianAdmin: false,
  },
  {
    id: "demo-u-649d",
    email: "medico.compleja@example.invalid",
    name: "Dra. Alfa · Demo",
    role: "doctor",
    clinicId: "demo-clinic-complex",
    recordIds: RECORD_IDS.slice(0, 2),
  },
  {
    id: "demo-u-825f",
    email: "medico2.compleja@example.invalid",
    name: "Dr. Beta · Demo",
    role: "doctor",
    clinicId: "demo-clinic-complex",
    recordIds: RECORD_IDS.slice(1, 3),
  },
  {
    id: "demo-u-527c",
    email: "recepcion.compleja@example.invalid",
    name: "Recepción Multiespecialidad · Demo",
    role: "reception",
    clinicId: "demo-clinic-complex",
  },
  {
    id: "demo-u-382a",
    email: "admin.dental@example.invalid",
    name: "Administración Dental · Demo",
    role: "admin",
    clinicId: "demo-clinic-dental",
    clinicianAdmin: false,
  },
  {
    id: "demo-u-461e",
    email: "medico.dental@example.invalid",
    name: "Dra. Gamma · Demo",
    role: "doctor",
    clinicId: "demo-clinic-dental",
    recordIds: RECORD_IDS.slice(3, 5),
  },
  {
    id: "demo-u-159c",
    email: "recepcion.dental@example.invalid",
    name: "Recepción Dental · Demo",
    role: "reception",
    clinicId: "demo-clinic-dental",
  },
  {
    id: "demo-u-936b",
    email: "admin.simple@example.invalid",
    name: "Administración Consulta · Demo",
    role: "admin",
    clinicId: "demo-clinic-simple",
    clinicianAdmin: false,
  },
  {
    id: "demo-u-284d",
    email: "medico.simple@example.invalid",
    name: "Dr. Delta · Demo",
    role: "doctor",
    clinicId: "demo-clinic-simple",
    recordIds: RECORD_IDS.slice(5, 7),
  },
  {
    id: "demo-u-697a",
    email: "recepcion.simple@example.invalid",
    name: "Recepción Consulta · Demo",
    role: "reception",
    clinicId: "demo-clinic-simple",
  },
];

export const DEMO_PATIENTS = [
  {
    id: "demo-p-84ac",
    recordId: RECORD_IDS[0],
    clinicId: "demo-clinic-complex",
    name: "Paciente Demo 01",
    doctorName: "Dra. Alfa · Demo",
    appointmentTime: "09:00",
    status: "Confirmada",
    specialty: "Medicina interna",
    summary: "Seguimiento sintético de medicina interna.",
  },
  {
    id: "demo-p-27bd",
    recordId: RECORD_IDS[1],
    clinicId: "demo-clinic-complex",
    name: "Paciente Demo 02",
    doctorName: "Dra. Alfa y Dr. Beta · Demo",
    appointmentTime: "10:30",
    status: "Por confirmar",
    specialty: "Seguimiento multidisciplinario",
    summary: "Caso ficticio compartido entre profesionales asignados.",
  },
  {
    id: "demo-p-63fe",
    recordId: RECORD_IDS[2],
    clinicId: "demo-clinic-complex",
    name: "Paciente Demo 03",
    doctorName: "Dr. Beta · Demo",
    appointmentTime: "12:00",
    status: "Confirmada",
    specialty: "Rehabilitación",
    summary: "Revisión sintética de rehabilitación.",
  },
  {
    id: "demo-p-92da",
    recordId: RECORD_IDS[3],
    clinicId: "demo-clinic-dental",
    name: "Paciente Demo 04",
    doctorName: "Dra. Gamma · Demo",
    appointmentTime: "09:30",
    status: "Confirmada",
    specialty: "Odontología general",
    summary: "Valoración dental ficticia.",
  },
  {
    id: "demo-p-51ce",
    recordId: RECORD_IDS[4],
    clinicId: "demo-clinic-dental",
    name: "Paciente Demo 05",
    doctorName: "Dra. Gamma · Demo",
    appointmentTime: "11:00",
    status: "Por confirmar",
    specialty: "Seguimiento dental",
    summary: "Revisión dental ficticia.",
  },
  {
    id: "demo-p-46ab",
    recordId: RECORD_IDS[5],
    clinicId: "demo-clinic-simple",
    name: "Paciente Demo 06",
    doctorName: "Dr. Delta · Demo",
    appointmentTime: "10:00",
    status: "Confirmada",
    specialty: "Consulta general",
    summary: "Consulta de ejemplo con antecedentes inventados.",
  },
  {
    id: "demo-p-75df",
    recordId: RECORD_IDS[6],
    clinicId: "demo-clinic-simple",
    name: "Paciente Demo 07",
    doctorName: "Dr. Delta · Demo",
    appointmentTime: "12:30",
    status: "Por confirmar",
    specialty: "Consulta general",
    summary: "Seguimiento ficticio de consulta general.",
  },
];

const RECORDS = DEMO_PATIENTS.map((patient, index) => ({
  id: patient.recordId,
  patientId: patient.id,
  patientName: patient.name,
  clinicId: patient.clinicId,
  specialty: patient.specialty,
  demo: true,
  summary: `${patient.summary} Este expediente es totalmente sintético y no corresponde a una persona real.`,
  allergies:
    index % 2
      ? [
          "Sin alergias consignadas en el ejemplo. Esto no equivale a confirmar su ausencia.",
        ]
      : [
          "Alergia ficticia registrada para demostrar la consulta; confirmar con el profesional.",
        ],
  medications: [
    "Sin lista verificada de medicamentos en este expediente de demostración.",
  ],
  treatments: [
    patient.clinicId === "demo-clinic-dental"
      ? "Revisión odontológica de ejemplo registrada; sin indicaciones terapéuticas."
      : "Seguimiento de ejemplo registrado; sin indicaciones terapéuticas.",
  ],
  history: [
    {
      date: "2026-10-12",
      title: "Valoración de demostración",
      detail:
        "Antecedentes inventados para enseñar la lectura del expediente y la revisión profesional. No se incluyen diagnósticos ni dosis utilizables.",
    },
  ],
  notes: [
    {
      id: `demo-n-${index}c41a`,
      text: "Nota sintética inicial. Ejemplo de documentación pendiente de revisión profesional.",
      author: patient.doctorName,
      date: "2026-10-12T15:00:00.000Z",
      status: "Ejemplo sintético sin firma",
    },
  ],
}));

// Freeze public fixtures too: callers must not grant themselves privileges by
// changing a user role or record assignment through an exported object.
function freeze(value) {
  Object.freeze(value);
  for (const child of Object.values(value))
    if (child && typeof child === "object" && !Object.isFrozen(child))
      freeze(child);
  return value;
}
[DEMO_CLINICS, DEMO_USERS, DEMO_PATIENTS, RECORDS].forEach(freeze);
const clone = (value) => JSON.parse(JSON.stringify(value));
const normalized = (text) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
function actor(session) {
  if (!session || typeof session !== "object") return null;
  const user = DEMO_USERS.find((candidate) => candidate.id === session.userId);
  return user &&
    user.role === session.role &&
    user.clinicId === session.clinicId
    ? user
    : null;
}
export function getAccessiblePatients(session) {
  const user = actor(session);
  if (!user) return [];
  return DEMO_PATIENTS.filter(
    (patient) =>
      patient.clinicId === user.clinicId &&
      (user.role !== "doctor" || user.recordIds.includes(patient.recordId)),
  ).map((patient) => {
    const { summary, specialty, ...operational } = patient;
    // Clinical descriptions are available only through the assigned record.
    return clone(operational);
  });
}
export function canReadRecord(session, recordId) {
  const user = actor(session),
    patient = DEMO_PATIENTS.find(
      (candidate) => candidate.recordId === recordId,
    );
  return !!(
    user &&
    patient &&
    user.clinicId === patient.clinicId &&
    ((user.role === "doctor" && user.recordIds.includes(recordId)) ||
      (user.role === "admin" &&
        user.clinicianAdmin === true &&
        user.recordIds?.includes(recordId)))
  );
}
export function getDemoRecord(session, recordId) {
  return canReadRecord(session, recordId)
    ? clone(RECORDS.find((record) => record.id === recordId))
    : null;
}
export function createDemoNote(session, recordId, text) {
  if (!canReadRecord(session, recordId))
    throw new Error(
      "Tu perfil demo no tiene permiso para documentar este expediente.",
    );
  if (
    typeof text !== "string" ||
    !text.trim() ||
    text.length > 2000 ||
    INVALID_NOTE_CONTROLS.test(text)
  )
    throw new Error("Escribe una nota ficticia de entre 1 y 2000 caracteres.");
  const user = actor(session);
  return {
    id: `demo-n-${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`,
    recordId,
    text: text.trim(),
    authorId: user.id,
    author: user.name,
    createdAt: new Date().toISOString(),
    status: DEMO_DRAFT_STATUS,
  };
}
export function appendDemoNote(session, recordId, records, text) {
  const record = getDemoRecordWithDrafts(session, recordId, records);
  if (!record)
    throw new Error(
      "Tu perfil demo no tiene permiso para documentar este expediente.",
    );
  const baseline = getDemoRecord(session, recordId);
  if (record.notes.length - baseline.notes.length >= DEMO_MAX_DRAFTS)
    throw new Error(
      `La demo admite hasta ${DEMO_MAX_DRAFTS} borradores por expediente. Reinicia la demo para comenzar otro ejemplo.`,
    );
  const note = createDemoNote(session, recordId, text);
  return { ...record, notes: [...record.notes, note] };
}
const denied = () => ({
  type: "denied",
  reply:
    "Tu perfil de demostración no tiene acceso a ese expediente. La recepción y la administración consultan la agenda; el profesional asignado consulta el expediente con su propia cuenta demo.",
});
const linksFor = (session, patients) =>
  patients
    .filter((patient) => canReadRecord(session, patient.recordId))
    .map((patient) => ({
      recordId: patient.recordId,
      label: `Abrir expediente demo · ${patient.name}`,
    }));
export function getDemoRecordWithDrafts(session, recordId, records) {
  const canonical = getDemoRecord(session, recordId);
  if (!canonical) return null;
  const candidate = Array.isArray(records)
    ? records.find((record) => record?.id === recordId)
    : records?.[recordId];
  if (
    !candidate ||
    typeof candidate !== "object" ||
    Array.isArray(candidate) ||
    candidate.id !== recordId ||
    candidate.clinicId !== canonical.clinicId ||
    candidate.patientId !== canonical.patientId ||
    candidate.demo !== true
  )
    return canonical;
  const user = actor(session);
  const seen = new Set(canonical.notes.map((note) => note.id));
  // Keep the original synthetic example intact. Only bounded, well-formed
  // drafts from this session's canonical actor can augment it; no override
  // can introduce a clinical signature or replace the patient identity.
  if (Array.isArray(candidate.notes)) {
    const candidates = candidate.notes.slice(
      0,
      DEMO_MAX_DRAFTS + canonical.notes.length,
    );
    let accepted = 0;
    for (const note of candidates) {
      if (
        accepted >= DEMO_MAX_DRAFTS ||
        !note ||
        typeof note !== "object" ||
        Array.isArray(note) ||
        typeof note.id !== "string" ||
        !/^demo-n-[a-zA-Z0-9-]{1,80}$/.test(note.id) ||
        seen.has(note.id) ||
        note.recordId !== recordId ||
        note.authorId !== user.id ||
        typeof note.text !== "string" ||
        !note.text.trim() ||
        note.text.length > 2000 ||
        INVALID_NOTE_CONTROLS.test(note.text) ||
        typeof note.createdAt !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(note.createdAt) ||
        !Number.isFinite(Date.parse(note.createdAt)) ||
        new Date(note.createdAt).toISOString() !== note.createdAt
      )
        continue;
      seen.add(note.id);
      accepted += 1;
      canonical.notes.push({
        id: note.id,
        recordId,
        text: note.text.trim(),
        authorId: user.id,
        author: user.name,
        createdAt: note.createdAt,
        status: DEMO_DRAFT_STATUS,
      });
    }
  }
  return canonical;
}
function boundedRecordReply(reply) {
  if (reply.length <= DEMO_MAX_RECORD_REPLY) return reply;
  const notice =
    "\n… Se omitió contenido por el límite de la demo. Consulta los borradores completos en el visor.";
  return reply.slice(0, DEMO_MAX_RECORD_REPLY - notice.length) + notice;
}
function targetPatient(text) {
  const match = normalized(text).match(/\bpaciente\s+(?:demo\s+)?0*(\d+)\b/);
  if (!match) return { explicit: false, patient: null };
  return {
    explicit: true,
    patient:
      DEMO_PATIENTS.find(
        (patient) => Number(patient.name.match(/\d+$/)[0]) === Number(match[1]),
      ) || null,
  };
}
const HELP =
  "Puedo mostrar los pacientes y la agenda de esta clínica demo, dar enlaces a expedientes asignados, leer su resumen o alergias registradas y preparar una nota ficticia para revisar antes de guardarla. Prueba «ver agenda», «abrir expedientes» o «resumen del expediente». Todos los datos son sintéticos; las notas duran solo durante esta sesión y no se envía información a Huli ni a una IA externa.";

export function answerDemoCopilot(text, { session, recordId, records } = {}) {
  if (
    typeof text !== "string" ||
    !text.trim() ||
    text.length > 2000 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)
  )
    return {
      type: "error",
      reply: "Escribe una consulta de demostración de hasta 2000 caracteres.",
    };
  const user = actor(session);
  if (!user)
    return {
      type: "unauthorized",
      reply:
        "Entra con una cuenta de demostración para consultar su clínica. Este acceso local solo sirve para probar el flujo.",
    };
  if (recordId && !canReadRecord(session, recordId)) return denied();
  const clean = text.trim(),
    command = normalized(clean),
    accessible = getAccessiblePatients(session);
  const target = targetPatient(clean);
  if (
    target.explicit &&
    (!target.patient ||
      !accessible.some((patient) => patient.id === target.patient.id))
  )
    return denied();
  const selectedId = target.patient?.recordId || recordId;
  const selected = selectedId ? getDemoRecord(session, selectedId) : null;
  const permitted = selectedId
    ? accessible.filter((patient) => patient.recordId === selectedId)
    : accessible;
  const links = linksFor(session, permitted);
  if (
    /\b(cofepris|nom(?:\s|-)?(?:0(?:04|05|13|16|24|87)|229)|rpbi|radiolog\w*|rayos\s+x|auditoria|normativa|cumplimiento|certificacion)\b/.test(
      command,
    )
  )
    return {
      type: "guidance",
      reply:
        "Esta demo no acredita cumplimiento ni certificación. Revisa en Controles y evidencia el alcance aplicable: expediente (NOM-004), consulta ambulatoria (NOM-005), odontología (NOM-013), hospitales y especialidades (NOM-016), sistemas de información (NOM-024), RPBI (NOM-087) y rayos X (NOM-229). La aplicabilidad depende de los servicios efectivos del establecimiento. Usar Huli o un servidor con estándares de seguridad no certifica por sí mismo a Stratos. La guía identifica evidencias pendientes y no sustituye una revisión sanitaria.",
    };
  if (/\b(huli|conexion|conectad[oa]|sincroniz\w*)\b/.test(command))
    return {
      type: "connection",
      reply:
        "Esta sesión es una demostración aislada. No consulta ni modifica Huli, no lee pacientes reales y no envía preguntas ni notas a una IA externa. Los enlaces abren expedientes sintéticos dentro de Stratos.",
    };
  if (
    /\b(diagnostica\w*|diagnosticar|prescrib\w*|recetame|dosis|recomiend\w*|que medicamento|que tratamiento debo|que le doy|interpret[ae]\w*)\b/.test(
      command,
    )
  )
    return {
      type: "blocked",
      reply:
        "Puedo mostrar información sintética registrada, pero no diagnosticar, interpretar resultados ni indicar tratamientos o dosis. Las decisiones clínicas requieren un profesional y un expediente real verificado.",
    };
  const noteMatch = clean.match(
    /(?:prepara|agrega|añade|anade|registra|guarda|escribe|anota)\s+(?:una?\s+)?nota(?:\s+(?:para|de)\s+paciente\s+(?:demo\s+)?\d+)?\s*[:：]\s*([\s\S]+)$/iu,
  );
  const clinicalQuestion =
    /\b(expedient\w*|historia|antecedentes|alergias?|medicamentos?|tratamientos?|diagnosticos?|notas?|resumen)\b/.test(
      command,
    );
  if (noteMatch || clinicalQuestion) {
    if (!links.length) return denied();
    // The global Copilot only returns links. Clinical content and draft notes
    // require the authorized record viewer, even when a patient is named.
    if (!recordId || selectedId !== recordId || !selected)
      return {
        type: "records",
        reply:
          "Abre un expediente demo asignado para consultar su contenido o preparar una nota. El enlace pide una cuenta demo con permiso para ese paciente.",
        links,
      };
    const record = getDemoRecordWithDrafts(session, selectedId, records);
    if (noteMatch) {
      const draftText = noteMatch[1].trim();
      try {
        createDemoNote(session, selectedId, draftText);
      } catch (error) {
        return { type: "error", reply: error.message };
      }
      return {
        type: "note-proposal",
        reply:
          "Preparé una nota ficticia para revisión. Todavía no está guardada ni firmada. Revisa el texto y confirma en el visor; el borrador permanecerá solo en esta sesión demo.",
        links,
        pendingNote: { recordId: selectedId, text: draftText },
      };
    }
    if (
      /\b(guarda|agrega|registra|escribe|anota|prepara|edita|cambia|modifica|borra|elimina|actualiza)\b/.test(
        command,
      )
    )
      return {
        type: "write-guidance",
        reply:
          "Para preparar un borrador usa «prepara nota: texto ficticio». Después revisa y confirma en el visor del expediente demo. No se guardó ni modificó información.",
        links,
      };
    let detail;
    if (/\balergias?\b/.test(command))
      detail = `Alergias registradas en el ejemplo:\n${record.allergies.map((value) => `• ${value}`).join("\n")}`;
    else if (/\bmedicamentos?\b/.test(command))
      detail = `Medicamentos registrados en el ejemplo:\n${record.medications.map((value) => `• ${value}`).join("\n")}`;
    else if (/\btratamientos?\b/.test(command))
      detail = `Tratamientos registrados en el ejemplo:\n${record.treatments.map((value) => `• ${value}`).join("\n")}`;
    else if (/\bdiagnosticos?\b/.test(command))
      detail =
        "Este expediente sintético no contiene diagnósticos utilizables para decisiones clínicas.";
    else if (/\bnotas?\b/.test(command))
      detail = record.notes.length
        ? `Notas demo:\n${record.notes.map((note) => `• ${note.text} (${note.status})`).join("\n")}`
        : "No hay notas en este expediente de demostración.";
    else if (/\b(historia|antecedentes)\b/.test(command))
      detail = record.history
        .map((item) => `• ${item.date} · ${item.title}: ${item.detail}`)
        .join("\n");
    else detail = record.summary;
    return {
      type: "record",
      reply: boundedRecordReply(
        `${record.patientName} · expediente sintético\n${detail}\nConsulta de lo registrado, sin interpretación ni indicación médica.`,
      ),
      links,
    };
  }
  if (
    /\b(agendame|agendar|agenda\s+(?:una|la)\s+cita|cancel\w*|reprogram\w*|reagend\w*|envi\w*|whatsapp|export\w*)\b/.test(
      command,
    )
  )
    return {
      type: "scope",
      reply:
        "La agenda y los recordatorios de esta demo son ejemplos. Esta consulta no creó citas, envió mensajes ni exportó datos. Puedes revisar los horarios ficticios en Agenda.",
    };
  if (/\b(agenda|citas?|horarios?|disponibilidad)\b/.test(command))
    return {
      type: "appointments",
      reply: `Jornada de ejemplo · ${DEMO_CLINICS.find((clinic) => clinic.id === user.clinicId).name}\n${accessible.map((patient) => `• ${patient.appointmentTime} · ${patient.name} · ${patient.doctorName} · ${patient.status}`).join("\n")}\nHorarios fijos ficticios; no corresponden a la fecha actual ni reservan disponibilidad.`,
    };
  if (/\bpacientes?\b/.test(command))
    return {
      type: "patients",
      reply: `${permitted.length} pacientes ficticios visibles para tu perfil:\n${permitted.map((patient) => `• ${patient.name} · ${patient.appointmentTime} · ${patient.status}`).join("\n")}`,
      ...(links.length ? { links } : {}),
    };
  if (/\b(cuenta|contrasena|acceso|permisos|roles?)\b/.test(command))
    return {
      type: "access",
      reply:
        "Cada cuenta demo tiene una clínica y un rol. Recepción y administración ven el listado y la agenda; el médico solo abre los expedientes asignados. Usa el selector de cuentas públicas en el acceso demo. No compartas cuentas ni contraseñas de producción.",
    };
  return { type: "help", reply: HELP };
}
