import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  FileText,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import {
  answerDemoCopilot,
  canReadRecord,
  getAccessiblePatients,
} from "./clinical-demo-model.mjs";
import { clinicalDemoRecordHref } from "./clinical-demo-session.mjs";
import "./clinical-demo-workspace.css";

const SUGGESTIONS = [
  ["Ver pacientes", "Ver pacientes"],
  ["Ver agenda", "Ver agenda de hoy"],
  ["Buscar expediente", "Abrir expediente"],
  ["Preparar auditoría", "Guía para preparar una auditoría COFEPRIS"],
];

function RecordLink({ recordId, label = "Abrir expediente", onOpenRecord }) {
  return (
    <a
      className="clinical-demo-record-link"
      href={clinicalDemoRecordHref(recordId)}
      onClick={(event) => {
        if (
          onOpenRecord &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey &&
          event.button === 0
        ) {
          event.preventDefault();
          onOpenRecord(recordId);
        }
      }}
    >
      <FileText size={16} aria-hidden="true" />
      <span>{label}</span>
      <ArrowUpRight size={15} aria-hidden="true" />
    </a>
  );
}

function normalized(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function PatientList({ session, patients, view, onOpenRecord }) {
  const [search, setSearch] = useState("");
  const isAgenda = view === "agenda";
  const matching = patients.filter((patient) =>
    normalized(`${patient.name} ${patient.doctorName}`).includes(
      normalized(search.trim()),
    ),
  );
  const visible = isAgenda
    ? [...matching].sort((a, b) =>
        (a.appointmentTime || "99:99").localeCompare(
          b.appointmentTime || "99:99",
        ),
      )
    : matching;
  return (
    <>
      <div className="clinical-demo-list-tools">
        <label className="clinical-demo-search">
          <Search size={18} aria-hidden="true" />
          <span className="clinical-demo-sr-only">
            Buscar pacientes o profesional
          </span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            maxLength={120}
            placeholder="Buscar paciente o profesional…"
            type="search"
          />
        </label>
        <p aria-live="polite">
          {visible.length}{" "}
          {visible.length === 1 ? "paciente ficticio" : "pacientes ficticios"}
        </p>
      </div>
      <section
        className="clinical-demo-list"
        aria-label={
          isAgenda
            ? "Agenda ficticia de la clínica"
            : "Pacientes ficticios disponibles"
        }
      >
        {isAgenda && (
          <p className="clinical-demo-list-caption">
            <CalendarDays size={16} aria-hidden="true" />
            Jornada de ejemplo · Horarios ficticios
          </p>
        )}
        {visible.length ? (
          visible.map((patient) => (
            <article className="clinical-demo-patient" key={patient.id}>
              {isAgenda && (
                <time className="clinical-demo-appointment-time">
                  {patient.appointmentTime || "Sin horario"}
                </time>
              )}
              <div className="clinical-demo-patient-info">
                <h2>{patient.name}</h2>
                <p>{patient.doctorName || "Profesional por asignar"}</p>
                <span>{patient.status || "Registro de demostración"}</span>
              </div>
              {canReadRecord(session, patient.recordId) ? (
                <RecordLink
                  recordId={patient.recordId}
                  onOpenRecord={onOpenRecord}
                />
              ) : (
                <span className="clinical-demo-restricted">
                  Expediente reservado al equipo médico
                </span>
              )}
            </article>
          ))
        ) : (
          <div className="clinical-demo-empty">
            <Users size={24} aria-hidden="true" />
            <h2>
              {search
                ? "No encontramos ese paciente"
                : "No hay pacientes disponibles para esta cuenta"}
            </h2>
            <p>
              {search
                ? "Prueba con otro nombre o borra la búsqueda."
                : "Selecciona otra cuenta demo para probar sus permisos y pacientes asignados."}
            </p>
            {search && (
              <button
                type="button"
                className="clinical-demo-button"
                onClick={() => setSearch("")}
              >
                Borrar búsqueda
              </button>
            )}
          </div>
        )}
      </section>
      <p className="clinical-demo-scope-note">
        <ShieldCheck size={16} aria-hidden="true" />
        Los expedientes ficticios se abren sólo con una cuenta médica
        autorizada. La recepción y la administración consultan la información de
        agenda.
      </p>
    </>
  );
}

function Copilot({ session, records, onOpenRecord, onAudit, onOpenReadiness }) {
  const examplePatient = getAccessiblePatients(session).find((patient) =>
    canReadRecord(session, patient.recordId),
  );
  const [messages, setMessages] = useState([
    {
      id: 0,
      role: "assistant",
      text: "Puedo encontrar pacientes ficticios, consultar la agenda y darte el enlace a un expediente autorizado. Abre el expediente para hacer preguntas sobre su contenido o preparar una nota clínica demo.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const nextId = useRef(0);
  const log = useRef(null);
  const input = useRef(null);

  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages]);

  function send(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (trimmed.length > 1000) {
      setError("Escribe una consulta de hasta 1,000 caracteres.");
      return;
    }
    if (onAudit && onAudit("copilot_query") === false) return;
    try {
      const response = answerDemoCopilot(trimmed, { session, records });
      if (!response || typeof response.reply !== "string")
        throw new Error("Respuesta no disponible.");
      const links = (response.links || []).filter((link) =>
        canReadRecord(session, link.recordId),
      );
      const userMessage = { id: ++nextId.current, role: "user", text: trimmed };
      const assistantMessage = {
        id: ++nextId.current,
        role: "assistant",
        text: response.pendingNote
          ? "Abre un expediente autorizado para preparar una nota clínica de demostración."
          : response.reply,
        links,
        type: response.type,
      };
      setMessages((previous) =>
        [...previous, userMessage, assistantMessage].slice(-20),
      );
      setDraft("");
      setError("");
      setNotice("");
    } catch {
      setError(
        "No pudimos resolver la consulta demo. Conservamos tu texto; puedes editarlo y volver a consultar.",
      );
      setDraft(trimmed);
    }
  }

  function clear() {
    setMessages([
      {
        id: ++nextId.current,
        role: "assistant",
        text: "La conversación se borró. Puedes buscar otro paciente ficticio o pedir una guía de preparación.",
      },
    ]);
    setDraft("");
    setError("");
    setNotice("Conversación borrada de esta sesión.");
    input.current?.focus();
  }

  return (
    <section
      className="clinical-demo-copilot"
      aria-labelledby="clinical-demo-copilot-title"
    >
      <div className="clinical-demo-copilot-head">
        <div>
          <h2 id="clinical-demo-copilot-title">Consulta con Copilot</h2>
          <p>Encuentra al paciente y continúa dentro de su expediente.</p>
        </div>
        <button type="button" className="clinical-demo-button" onClick={clear}>
          <Trash2 size={16} aria-hidden="true" />
          Borrar conversación
        </button>
      </div>
      <div
        className="clinical-demo-suggestions"
        aria-label="Consultas sugeridas"
      >
        {SUGGESTIONS.map(([label, text]) => (
          <button
            type="button"
            className="clinical-demo-button"
            key={label}
            onClick={() => send(text)}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        className="clinical-demo-messages"
        ref={log}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Conversación con Copilot demo"
      >
        {messages.map((message) => (
          <article
            key={message.id}
            className={`clinical-demo-message clinical-demo-message-${message.role}`}
          >
            <span className="clinical-demo-message-author">
              {message.role === "user" ? "Tú" : "Stratos Copilot · Demo"}
            </span>
            <p>{message.text}</p>
            {Boolean(message.links?.length) && (
              <div className="clinical-demo-message-links">
                {message.links.map((link) => (
                  <RecordLink
                    key={link.recordId}
                    recordId={link.recordId}
                    label={link.label}
                    onOpenRecord={onOpenRecord}
                  />
                ))}
              </div>
            )}
            {message.type === "guidance" && onOpenReadiness && (
              <button
                type="button"
                className="clinical-demo-button"
                onClick={onOpenReadiness}
              >
                Abrir guía de preparación
                <ArrowUpRight size={15} aria-hidden="true" />
              </button>
            )}
          </article>
        ))}
      </div>
      {error && (
        <p className="clinical-demo-error" role="alert">
          {error}
        </p>
      )}
      <form
        className="clinical-demo-composer"
        onSubmit={(event) => {
          event.preventDefault();
          send(draft);
        }}
      >
        <label htmlFor="clinical-demo-copilot-input">
          Consulta para Copilot demo
        </label>
        <div>
          <textarea
            id="clinical-demo-copilot-input"
            ref={input}
            value={draft}
            maxLength={1000}
            rows={2}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={
              examplePatient
                ? `Por ejemplo: abrir expediente de ${examplePatient.name}`
                : "Por ejemplo: ver agenda de la clínica"
            }
            aria-describedby="clinical-demo-copilot-help"
          />
          <button
            type="submit"
            className="clinical-demo-button clinical-demo-button-primary"
            disabled={!draft.trim()}
          >
            <Send size={17} aria-hidden="true" />
            Consultar
          </button>
        </div>
        <p id="clinical-demo-copilot-help">
          Usa sólo datos ficticios. La conversación no se guarda al salir de
          este módulo. Las preguntas clínicas se hacen dentro de un expediente
          autorizado.
        </p>
      </form>
      <p className="clinical-demo-notice" role="status">
        {notice}
      </p>
    </section>
  );
}

function Workspace({
  session,
  patients,
  view,
  onOpenRecord,
  onAudit,
  onOpenReadiness,
  records,
}) {
  const allowed = new Set(
    getAccessiblePatients(session).map((patient) => patient.id),
  );
  const visiblePatients = (patients || getAccessiblePatients(session)).filter(
    (patient) => allowed.has(patient.id),
  );
  const isCopilot = view === "copilot";
  const isAgenda = view === "agenda";
  return (
    <main className="clinical-demo-surface clinical-demo-workspace">
      <div className="clinical-demo-workspace-heading">
        <div>
          <h1>
            {isCopilot
              ? "Copilot de la clínica"
              : isAgenda
                ? "Agenda de la clínica"
                : "Pacientes"}
          </h1>
          <p>
            {isCopilot
              ? "Busca expedientes, consulta la agenda y prepara la revisión de la clínica."
              : isAgenda
                ? "Revisa una jornada ficticia y accede a los expedientes permitidos por tu rol."
                : "Busca pacientes ficticios y abre los expedientes asignados a tu cuenta."}
          </p>
        </div>
        {onOpenReadiness && (
          <button
            type="button"
            className="clinical-demo-button"
            onClick={onOpenReadiness}
          >
            <ShieldCheck size={17} aria-hidden="true" />
            Preparación de la clínica
          </button>
        )}
      </div>
      {isCopilot ? (
        <Copilot
          session={session}
          records={records}
          onOpenRecord={onOpenRecord}
          onAudit={onAudit}
          onOpenReadiness={onOpenReadiness}
        />
      ) : (
        <PatientList
          session={session}
          patients={visiblePatients}
          view={view}
          onOpenRecord={onOpenRecord}
        />
      )}
    </main>
  );
}

export default function ClinicalDemoWorkspace({ view = "copilot", ...props }) {
  return (
    <Workspace
      key={`${props.session.userId}:${props.session.role}:${props.session.clinicId}:${view}`}
      {...props}
      view={view}
    />
  );
}
