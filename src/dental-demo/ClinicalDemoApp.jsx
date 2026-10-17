import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUp,
  Check,
  ClipboardList,
  FileText,
  LogOut,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import ClinicalDemoWorkspace from "./ClinicalDemoWorkspace";
import ClinicalReadiness from "./ClinicalReadiness";
import {
  DEMO_CLINICS,
  DEMO_PATIENTS,
  DEMO_USERS,
  appendDemoNote,
  answerDemoCopilot,
  canReadRecord,
  getAccessiblePatients,
  getDemoRecordWithDrafts,
} from "./clinical-demo-model.mjs";
import {
  DEMO_ACCESS_PASSWORD,
  clinicalDemoRecordHref,
  isClinicalDemoSessionActive,
  observeClinicalDemoSession,
  requestedDemoRecord,
  signInClinicalDemo,
  touchClinicalDemoSession,
} from "./clinical-demo-session.mjs";
import "./clinical-demo-app.css";

const ROLE_LABELS = {
  doctor: "Médico · Expedientes asignados",
  reception: "Recepción · Agenda y pacientes",
  admin: "Dirección · Operación sin expediente",
};

function DemoLogin({
  clinicId,
  setClinicId,
  onLogin,
  recordRequested,
  notice,
}) {
  const users = DEMO_USERS.filter((user) => user.clinicId === clinicId);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const clinic = DEMO_CLINICS.find((item) => item.id === clinicId);
  function submit(event) {
    event.preventDefault();
    const result = onLogin(email, password);
    setError(result.error || "");
  }
  return (
    <main className="clinical-demo-login">
      <div className="clinical-demo-login-intro">
        <a className="clinical-demo-wordmark" href="/">
          Stratos <span>AI</span>
        </a>
        <h1 tabIndex={-1}>
          El expediente correcto.
          <br />
          Para la persona autorizada.
        </h1>
        <p>
          Prueba cómo Copilot entrega un enlace, el médico verifica su acceso y
          consulta o prepara una nota dentro del expediente.
        </p>
        <p className="clinical-demo-demo-label">
          Demo aislada · Todos los datos son ficticios
        </p>
        <ol>
          <li>Elige una clínica y una cuenta de ejemplo.</li>
          <li>Pide a Copilot los expedientes asignados.</li>
          <li>Abre el enlace y revisa un borrador de nota.</li>
        </ol>
        <p className="clinical-demo-limit">
          Las cuentas son públicas. Esta demo simula acceso y roles en el
          navegador; no protege expedientes reales ni utiliza Huli.
        </p>
      </div>
      <section
        className="clinical-demo-access"
        aria-labelledby="clinical-demo-login-title"
      >
        <h2 id="clinical-demo-login-title">Acceso de demostración</h2>
        {recordRequested && (
          <p className="clinical-demo-notice" role="status">
            Inicia sesión para comprobar si esta cuenta puede abrir el
            expediente solicitado. El enlace no concede acceso.
          </p>
        )}
        {notice && (
          <p className="clinical-demo-notice" role="status">
            {notice}
          </p>
        )}
        <label htmlFor="clinical-demo-clinic">Escenario clínico</label>
        <select
          id="clinical-demo-clinic"
          value={clinicId}
          onChange={(event) => {
            setClinicId(event.target.value);
            setEmail("");
            setPassword("");
            setError("");
          }}
        >
          {DEMO_CLINICS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <p className="clinical-demo-clinic-description">
          {clinic?.description}
        </p>
        <h3>Cuentas de ejemplo</h3>
        <div className="clinical-demo-account-list">
          {users.map((user) => (
            <button
              type="button"
              key={user.id}
              onClick={() => {
                setEmail(user.email);
                setPassword(DEMO_ACCESS_PASSWORD);
                setError("");
              }}
            >
              <strong>{ROLE_LABELS[user.role]}</strong>
              <span>{user.email}</span>
            </button>
          ))}
        </div>
        <form onSubmit={submit}>
          <label htmlFor="clinical-demo-email">Cuenta demo</label>
          <input
            id="clinical-demo-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="off"
            required
            maxLength={120}
          />
          <label htmlFor="clinical-demo-password">Contraseña demo</label>
          <input
            id="clinical-demo-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="off"
            required
            maxLength={80}
          />
          <p className="clinical-demo-public-password">
            Contraseña pública de ejemplo:{" "}
            <strong>{DEMO_ACCESS_PASSWORD}</strong>
          </p>
          {error && (
            <p className="clinical-demo-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="clinical-demo-primary">
            Entrar a la demo <ArrowUp size={16} aria-hidden="true" />
          </button>
        </form>
      </section>
    </main>
  );
}

function DemoRecord({
  session,
  record,
  records,
  onBack,
  onSaveNote,
  onAudit,
  onOpenRecord,
}) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Consulta la información ficticia de este expediente o prepara una nota para revisar. No genero diagnósticos ni prescripciones.",
    },
  ]);
  const [input, setInput] = useState("");
  const [pendingNote, setPendingNote] = useState(null);
  const [notice, setNotice] = useState("");
  const log = useRef(null);
  const heading = useRef(null);
  const recordInput = useRef(null);
  const noteInput = useRef(null);
  const isReviewingNote = Boolean(pendingNote);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  useEffect(() => {
    if (isReviewingNote) noteInput.current?.focus();
  }, [isReviewingNote]);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages]);
  function send(text) {
    if (!text.trim()) return;
    if (!onAudit("record_query")) return;
    const response = answerDemoCopilot(text, {
      session,
      recordId: record.id,
      records,
    });
    setMessages((previous) =>
      [
        ...previous,
        { role: "user", text: text.trim() },
        { role: "assistant", text: response.reply, links: response.links },
      ].slice(-30),
    );
    if (response.pendingNote) setPendingNote(response.pendingNote);
    setInput("");
    setNotice("");
  }
  function saveNote() {
    const result = onSaveNote(record.id, pendingNote?.text || "");
    if (result.error) {
      setNotice(result.error);
      return;
    }
    setPendingNote(null);
    setNotice(
      "Borrador guardado sólo en la memoria de esta demo. No es una nota firmada ni se envió a Huli.",
    );
    recordInput.current?.focus();
  }
  return (
    <main className="clinical-demo-record">
      <button
        type="button"
        className="clinical-demo-secondary"
        onClick={onBack}
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Volver al espacio clínico
      </button>
      <header className="clinical-demo-record-heading">
        <div>
          <h1 ref={heading} tabIndex={-1}>
            Expediente de {record.patientName}
          </h1>
          <p>{record.specialty} · Datos ficticios</p>
        </div>
        <span>
          <ShieldCheck size={16} aria-hidden="true" />
          Acceso asignado · Demo
        </span>
      </header>
      <div className="clinical-demo-record-grid">
        <section
          className="clinical-demo-record-content"
          aria-labelledby="clinical-demo-record-title"
        >
          <h2 id="clinical-demo-record-title">Información registrada</h2>
          <p>{record.summary}</p>
          <dl>
            <div>
              <dt>Alergias registradas</dt>
              <dd>
                {record.allergies?.join("; ") ||
                  "Sin datos ficticios registrados"}
              </dd>
            </div>
            <div>
              <dt>Medicamentos registrados</dt>
              <dd>
                {record.medications?.join("; ") ||
                  "Sin datos ficticios registrados"}
              </dd>
            </div>
            <div>
              <dt>Tratamientos registrados</dt>
              <dd>
                {record.treatments?.join("; ") ||
                  "Sin datos ficticios registrados"}
              </dd>
            </div>
          </dl>
          <h3>Historial ficticio</h3>
          <ol className="clinical-demo-history">
            {record.history?.map((item, index) => (
              <li key={`${item.date}-${index}`}>
                <time>{item.date}</time>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </li>
            ))}
          </ol>
          <h3>Borradores de esta demo</h3>
          {record.notes?.length ? (
            <ul className="clinical-demo-notes">
              {record.notes.map((note, index) => (
                <li key={note.id || index}>
                  <strong>{note.status || "Borrador demo sin firma"}</strong>
                  <p>{note.text}</p>
                  <small>
                    {note.author} · {note.createdAt || note.date}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p>No has añadido borradores a este expediente.</p>
          )}
          <p className="clinical-demo-limit">
            La revisión y firma clínica corresponden al profesional en el
            sistema de expediente validado. Esta simulación no firma ni envía
            documentos.
          </p>
        </section>
        <section
          className="clinical-demo-record-copilot"
          aria-labelledby="clinical-demo-record-copilot-title"
        >
          <h2 id="clinical-demo-record-copilot-title">
            Copilot del expediente
          </h2>
          <p>
            Consulta datos registrados. Cada propuesta de nota requiere tu
            revisión.
          </p>
          <div className="clinical-demo-record-suggestions">
            {[
              "Resumen del expediente",
              "Alergias registradas",
              "Tratamientos registrados",
              "Prepara nota: Seguimiento ficticio revisado por el médico demo.",
            ].map((text) => (
              <button type="button" key={text} onClick={() => send(text)}>
                {text.startsWith("Prepara") ? "Preparar nota de ejemplo" : text}
              </button>
            ))}
          </div>
          <div
            ref={log}
            className="clinical-demo-record-messages"
            role="log"
            aria-live="polite"
            aria-label="Conversación sobre el expediente ficticio"
          >
            {messages.map((message, index) => (
              <article
                key={index}
                className={`clinical-demo-record-message ${message.role}`}
              >
                <span>{message.role === "user" ? "Tú" : "Copilot · Demo"}</span>
                <p>{message.text}</p>
              </article>
            ))}
          </div>
          {messages
            .at(-1)
            ?.links?.filter(
              (link) =>
                link.recordId !== record.id &&
                canReadRecord(session, link.recordId),
            )
            .map((link) => (
              <a
                key={link.recordId}
                className="clinical-demo-secondary"
                href={clinicalDemoRecordHref(link.recordId)}
                onClick={(event) => {
                  if (
                    !event.metaKey &&
                    !event.ctrlKey &&
                    !event.shiftKey &&
                    !event.altKey &&
                    event.button === 0
                  ) {
                    event.preventDefault();
                    onOpenRecord(link.recordId);
                  }
                }}
              >
                {link.label}
              </a>
            ))}
          {pendingNote && (
            <div className="clinical-demo-note-review">
              <label htmlFor="clinical-demo-note-text">
                Revisa el borrador antes de guardarlo
              </label>
              <textarea
                id="clinical-demo-note-text"
                ref={noteInput}
                value={pendingNote.text}
                onChange={(event) =>
                  setPendingNote({ ...pendingNote, text: event.target.value })
                }
                maxLength={2000}
                rows={4}
                aria-describedby="clinical-demo-note-help"
              />
              <p id="clinical-demo-note-help">
                Se guardará como borrador ficticio, sin firma y sólo mientras
                esta demo esté abierta.
              </p>
              <div>
                <button
                  type="button"
                  className="clinical-demo-primary"
                  onClick={saveNote}
                  disabled={!pendingNote.text.trim()}
                >
                  <Check size={16} aria-hidden="true" />
                  Guardar borrador demo
                </button>
                <button
                  type="button"
                  className="clinical-demo-secondary"
                  onClick={() => {
                    setPendingNote(null);
                    recordInput.current?.focus();
                  }}
                >
                  Descartar
                </button>
              </div>
            </div>
          )}
          <p className="clinical-demo-notice" role="status">
            {notice}
          </p>
          <form
            className="clinical-demo-record-composer"
            onSubmit={(event) => {
              event.preventDefault();
              send(input);
            }}
          >
            <label htmlFor="clinical-demo-record-input">
              Pregunta o instrucción para este expediente ficticio
            </label>
            <div>
              <input
                id="clinical-demo-record-input"
                ref={recordInput}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                maxLength={1000}
                autoComplete="off"
                placeholder="Consulta datos o escribe: prepara nota…"
                aria-describedby="clinical-demo-record-help"
              />
              <button
                type="submit"
                className="clinical-demo-primary"
                disabled={!input.trim()}
                aria-label="Enviar consulta del expediente"
              >
                <ArrowUp size={18} />
              </button>
            </div>
            <p id="clinical-demo-record-help" className="clinical-demo-limit">
              Usa sólo datos ficticios. No introduzcas información de pacientes
              reales.
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}

export default function ClinicalDemoApp() {
  const clinicalDemoRoot = useRef(null);
  const sessionRef = useRef(null);
  const [clinicId, setClinicId] = useState(
    () =>
      DEMO_PATIENTS.find(
        (patient) =>
          patient.recordId === requestedDemoRecord(window.location.search),
      )?.clinicId || DEMO_CLINICS[0].id,
  );
  const [session, setSession] = useState(null);
  const [view, setView] = useState("copilot");
  const [recordId, setRecordId] = useState(() =>
    requestedDemoRecord(window.location.search),
  );
  const [records, setRecords] = useState({});
  const [events, setEvents] = useState([]);
  const [notice, setNotice] = useState("");
  const [resetVersion, setResetVersion] = useState(0);
  const activeSession = isClinicalDemoSessionActive(session) ? session : null;
  const activeUserId = activeSession?.userId;
  const user = DEMO_USERS.find((item) => item.id === activeUserId);
  const clinic = DEMO_CLINICS.find((item) => item.id === clinicId);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  useEffect(() => {
    document.title = "Stratos AI · Demo clínica";
  }, []);
  function clearPrivateDemoState() {
    setRecords({});
    setEvents([]);
  }
  function endSession(
    message = "Sesión demo cerrada. Los borradores y conversaciones se han eliminado.",
  ) {
    setSession(null);
    clearPrivateDemoState();
    setNotice(message);
  }
  useEffect(() => {
    const onPopState = () =>
      setRecordId(requestedDemoRecord(window.location.search));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  useEffect(() => {
    if (!session) return;
    return observeClinicalDemoSession({
      getSession: () => sessionRef.current,
      onExpire: () => {
        sessionRef.current = null;
        setSession(null);
        setRecords({});
        setEvents([]);
        setNotice(
          "La sesión demo caducó por inactividad. Vuelve a entrar para acceder al expediente.",
        );
      },
      onActivity: (nextSession) => {
        sessionRef.current = nextSession;
        setSession(nextSession);
      },
      activityTarget: clinicalDemoRoot.current,
      windowTarget: window,
      documentTarget: document,
    });
  }, [session]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (
        sessionRef.current &&
        !isClinicalDemoSessionActive(sessionRef.current)
      )
        return;
      const heading = clinicalDemoRoot.current?.querySelector(
        "main h1, .clinical-demo-record h1",
      );
      if (heading) {
        heading.tabIndex = -1;
        heading.focus();
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeUserId, view, recordId, resetVersion]);
  function audit(action) {
    if (!isClinicalDemoSessionActive(session)) {
      endSession("La sesión demo caducó. Vuelve a entrar.");
      return false;
    }
    setSession((previous) => touchClinicalDemoSession(previous));
    setEvents((previous) =>
      [
        ...previous,
        {
          action,
          role: session.role,
          clinicId: session.clinicId,
          occurredAt: new Date().toISOString(),
        },
      ].slice(-40),
    );
    return true;
  }
  function login(email, password) {
    const result = signInClinicalDemo(email, password, clinicId);
    if (result.session) {
      clearPrivateDemoState();
      setSession(result.session);
      setView("copilot");
      setNotice("");
      setEvents([
        {
          action: "demo_login",
          role: result.session.role,
          clinicId,
          occurredAt: new Date().toISOString(),
        },
      ]);
    }
    return result;
  }
  function openRecord(id) {
    if (!audit("record_link_opened")) return;
    if (!canReadRecord(session, id)) {
      setNotice("Esta cuenta demo no tiene permiso para ese expediente.");
      return;
    }
    window.history.pushState({}, "", clinicalDemoRecordHref(id));
    setRecordId(id);
  }
  function closeRecord() {
    if (!audit("record_closed")) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("record");
    window.history.pushState({}, "", `${url.pathname}${url.search}`);
    setRecordId(null);
  }
  function saveNote(id, text) {
    if (!audit("draft_reviewed")) return { error: "La sesión demo caducó." };
    try {
      const updated = appendDemoNote(session, id, records, text);
      setRecords((previous) => ({
        ...previous,
        [id]: updated,
      }));
      return { note: updated.notes.at(-1) };
    } catch (error) {
      return { error: error.message };
    }
  }
  const record =
    activeSession && recordId
      ? getDemoRecordWithDrafts(activeSession, recordId, records)
      : null;
  return (
    <div ref={clinicalDemoRoot} className="clinical-demo-app" data-theme="dark">
      {!activeSession ? (
        <DemoLogin
          clinicId={clinicId}
          setClinicId={setClinicId}
          onLogin={login}
          recordRequested={!!recordId}
          notice={notice}
        />
      ) : (
        <>
          <header className="clinical-demo-app-header">
            <a className="clinical-demo-wordmark" href="/clinica-dental-demo">
              Stratos <span>AI</span>
            </a>
            <div>
              <strong>{clinic?.name}</strong>
              <span>Demo · {ROLE_LABELS[user?.role]}</span>
            </div>
            <button
              type="button"
              className="clinical-demo-secondary"
              onClick={() => endSession()}
            >
              <LogOut size={16} aria-hidden="true" />
              Cerrar sesión
            </button>
          </header>
          <div className="clinical-demo-app-disclosure">
            Datos ficticios · Huli no se consulta · Las cuentas y permisos son
            de demostración
          </div>
          {recordId ? (
            record ? (
              <DemoRecord
                key={`${activeSession.userId}-${recordId}`}
                session={activeSession}
                record={record}
                records={records}
                onBack={closeRecord}
                onSaveNote={saveNote}
                onAudit={audit}
                onOpenRecord={openRecord}
              />
            ) : (
              <main className="clinical-demo-denied">
                <ShieldCheck size={32} aria-hidden="true" />
                <h1>Esta cuenta no puede abrir el expediente</h1>
                <p>
                  La demo comprueba la clínica, el rol y la asignación al
                  médico. Compartir o modificar el enlace no concede permisos.
                </p>
                <div>
                  <button
                    type="button"
                    className="clinical-demo-primary"
                    onClick={closeRecord}
                  >
                    Volver a mi espacio
                  </button>
                  <button
                    type="button"
                    className="clinical-demo-secondary"
                    onClick={() =>
                      endSession(
                        "Prueba una cuenta médica asignada al expediente de esta clínica.",
                      )
                    }
                  >
                    Cambiar de cuenta demo
                  </button>
                </div>
              </main>
            )
          ) : (
            <>
              <nav
                className="clinical-demo-app-nav"
                aria-label="Espacio clínico demo"
              >
                {[
                  ["copilot", "Copilot"],
                  ["patients", "Pacientes"],
                  ["agenda", "Agenda"],
                  ["controls", "Controles y evidencia"],
                ].map(([id, label]) => (
                  <button
                    type="button"
                    key={id}
                    aria-current={view === id ? "page" : undefined}
                    onClick={() => {
                      if (audit("view_changed")) setView(id);
                    }}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  className="clinical-demo-reset"
                  onClick={() => {
                    if (!audit("demo_reset")) return;
                    clearPrivateDemoState();
                    setResetVersion((previous) => previous + 1);
                    setNotice(
                      "Se reiniciaron los datos temporales de la demo.",
                    );
                  }}
                >
                  <RotateCcw size={15} aria-hidden="true" />
                  Reiniciar demo
                </button>
              </nav>
              {notice && (
                <p className="clinical-demo-app-notice" role="status">
                  {notice}
                </p>
              )}
              {view === "controls" ? (
                <main className="clinical-demo-controls">
                  <h1 tabIndex={-1}>Auditoría de preparación</h1>
                  <ClinicalReadiness
                    metadata={{ mode: "demo", scenario: clinicId }}
                  />
                  <section
                    className="clinical-demo-audit"
                    aria-labelledby="clinical-demo-audit-title"
                  >
                    <h2 id="clinical-demo-audit-title">
                      <ClipboardList size={19} aria-hidden="true" />
                      Actividad de esta demo
                    </h2>
                    <p>
                      Registro temporal de acciones, sin consultas ni contenido
                      clínico. Se elimina al cerrar sesión o reiniciar; no es
                      una bitácora clínica persistente.
                    </p>
                    <ol>
                      {events
                        .slice(-12)
                        .reverse()
                        .map((event, index) => (
                          <li key={`${event.occurredAt}-${index}`}>
                            <time>
                              {new Date(event.occurredAt).toLocaleTimeString(
                                "es-MX",
                              )}
                            </time>
                            <span>
                              {{
                                demo_login: "Acceso de demostración",
                                record_link_opened:
                                  "Apertura de enlace de expediente",
                                record_query: "Consulta dentro del expediente",
                                record_closed: "Cierre del visor de expediente",
                                draft_reviewed: "Revisión de borrador",
                                demo_reset: "Reinicio de datos temporales",
                                view_changed: "Cambio de sección",
                                copilot_query: "Consulta de Copilot",
                              }[event.action] || "Acción de demostración"}
                            </span>
                            <small>{ROLE_LABELS[event.role]}</small>
                          </li>
                        ))}
                    </ol>
                  </section>
                </main>
              ) : (
                <ClinicalDemoWorkspace
                  key={`${activeSession.userId}-${clinicId}-${view}-${resetVersion}`}
                  session={activeSession}
                  patients={getAccessiblePatients(activeSession)}
                  view={view}
                  onOpenRecord={openRecord}
                  onAudit={audit}
                  onOpenReadiness={() => {
                    if (audit("view_changed")) setView("controls");
                  }}
                  records={records}
                />
              )}
            </>
          )}
        </>
      )}
      <footer className="clinical-demo-app-footer">
        <FileText size={15} aria-hidden="true" />
        <span>
          Prototipo de Stratos AI. Sin pacientes reales, conexión clínica ni
          certificación sanitaria. Ningún dato de esta demo se envía a servicios
          de IA.
        </span>
      </footer>
    </div>
  );
}
