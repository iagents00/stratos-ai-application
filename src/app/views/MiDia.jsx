/** Seller workspace. A result is completed only after the server acknowledges it. */
import { useState, useMemo, useEffect, useRef, useId } from "react";
import {
  Phone,
  MessageCircle,
  Check,
  CalendarClock,
  Plus,
  LayoutGrid,
  ChevronDown,
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
} from "lucide-react";
import { P, LP } from "../../design-system/tokens";
import { listaDelDia, proximaAccion } from "../../lib/next-action-engine";
import { hrefDelCanal } from "../../lib/telefono";
import { agendaDeHoy, marcarAccion } from "../../lib/agenda";
import { useAuth } from "../../hooks/useAuth";
import "../features/Admin/Rails.css";
import { railsTheme } from "../features/Admin/rails-theme";
// Matches CURRENT_DATE in the existing agenda RPC (UTC); see the day-boundary limitation in the runbook.
const defaultPersistence = { read: agendaDeHoy, write: marcarAccion };
const dayKey = () => new Date().toISOString().slice(0, 10);
export default function MiDia(props) {
  const { user } = useAuth();
  const [day, setDay] = useState(dayKey);
  useEffect(() => {
    const timer = setInterval(() => setDay(dayKey()), 30000);
    return () => clearInterval(timer);
  }, []);
  return (
    <Lista
      key={`${user?.id}:${user?.organizationId}:${day}`}
      {...props}
      demo={!!user?.isDemo || user?.id === "demo-user-local"}
    />
  );
}
function Lista({
  leads = [],
  T: palette,
  theme = "dark",
  config,
  recienRegistrado,
  onNuevoCliente,
  onVerCRM,
  onMover,
  onAbrirCliente,
  demo,
  persistence = defaultPersistence,
}) {
  const T = palette || (theme === "light" ? LP : P);
  const [closed, setClosed] = useState({});
  const [activeId, setActiveId] = useState(null);
  const workspace = useRef(null);
  const focusAfterResult = useRef(false);
  const [history, setHistory] = useState({ loading: true, error: "" });
  const [notice, setNotice] = useState("");
  const [batch, setBatch] = useState([]);
  const [version, setVersion] = useState(config);
  const [lastNew, setLastNew] = useState(recienRegistrado);
  const all = useMemo(
    () => listaDelDia(leads, { max: Number.MAX_SAFE_INTEGER, config }).visibles,
    [leads, config],
  );
  const remaining = all.filter((a) => !closed[a.leadId]);
  const limit = config?.maxTarjetas || 7;
  const load = async () => {
    setHistory({ loading: true, error: "" });
    try {
      const saved = demo ? {} : await persistence.read();
      setClosed((prev) => ({ ...saved, ...prev }));
      setHistory({ loading: false, error: "" });
    } catch {
      setHistory({
        loading: false,
        error:
          "No pudimos verificar los resultados de hoy. Reintenta antes de registrar otro resultado.",
      });
    }
  };
  useEffect(() => {
    let alive = true;
    (demo ? Promise.resolve({}) : persistence.read())
      .then((saved) => {
        if (alive) {
          setClosed(saved);
          setHistory({ loading: false, error: "" });
        }
      })
      .catch(() => {
        if (alive)
          setHistory({
            loading: false,
            error:
              "No pudimos verificar los resultados de hoy. Reintenta antes de registrar otro resultado.",
          });
      });
    return () => {
      alive = false;
    };
  }, [demo, persistence]);
  // Stable membership; time/refresh never reshuffles existing work. Safety always wins:
  // disappeared, opted-out, closed or future-scheduled leads are removed immediately.
  const byId = new Map(all.map((a) => [a.leadId, a]));
  if (
    !history.loading &&
    !history.error &&
    (version !== config || (!batch.length && remaining.length))
  ) {
    setVersion(config);
    setBatch(remaining.slice(0, limit).map((a) => a.leadId));
  }
  if (recienRegistrado && recienRegistrado !== lastNew) {
    setLastNew(recienRegistrado);
    if (byId.has(recienRegistrado))
      setBatch((ids) =>
        [
          recienRegistrado,
          ...ids.filter((id) => id !== recienRegistrado),
        ].slice(0, limit),
      );
  }
  const visible = batch
    .map((id) => byId.get(id))
    .filter((a) => a && !closed[a.leadId]);
  const outside = remaining.filter((a) => !batch.includes(a.leadId));
  const completed = Object.values(closed).filter((v) => v === "hecho").length;
  const moved = Object.values(closed).filter((v) => v === "movido").length;
  const unanswered = Object.values(closed).filter(
    (v) => v === "saltado",
  ).length;
  const activeActionId = visible.some((a) => a.leadId === activeId)
    ? activeId
    : visible[0]?.leadId;
  const batchDone = batch.filter((id) => closed[id]).length;
  const batchTotal = batchDone + visible.length;
  useEffect(() => {
    if (!focusAfterResult.current) return;
    focusAfterResult.current = false;
    workspace.current?.querySelector("[data-rails-current]")?.focus();
  }, [closed, batch, activeId]);
  const finish = async (action, state, details = null) => {
    // Recheck latest props before a write; a stale contact must never be worked.
    const lead = leads.find((l) => l.id === action.leadId);
    if (!lead || !proximaAccion(lead, new Date(), config))
      throw new Error(
        "Este cliente cambió. Consulta su ficha antes de continuar.",
      );
    if (!demo && !(await persistence.write(action, state, details)))
      throw new Error(
        "No se confirmó el resultado. Tu acción sigue pendiente; revisa la conexión y reintenta.",
      );
    focusAfterResult.current = true;
    setClosed((prev) => ({ ...prev, [action.leadId]: state }));
    setNotice(
      demo
        ? "Resultado simulado. No se guardó en una cuenta real."
        : state === "hecho"
          ? "Resultado guardado."
          : state === "saltado"
            ? "Sin respuesta registrado. El cliente se volverá a evaluar en la lista del próximo día."
            : "Nueva fecha y resultado guardados.",
    );
  };
  return (
    <section
      ref={workspace}
      className="rails-day"
      style={railsTheme(T)}
      aria-label="Mi Día · Ventas sobre Rieles"
    >
      <header className="rails-day-header">
        <div>
          <h2>Mi Día</h2>
          <p className="rails-muted">
            Un cliente a la vez. Un siguiente paso claro.
          </p>
        </div>
        <div className="rails-actions rails-toolbar">
          <button className="rails-button" onClick={onNuevoCliente}>
            <Plus size={17} aria-hidden="true" /> Nuevo cliente
          </button>
          <button className="rails-button" onClick={onVerCRM}>
            <LayoutGrid size={17} aria-hidden="true" /> Todos mis clientes
          </button>
        </div>
      </header>
      <div className="rails-day-summary">
        <dl className="rails-counts" aria-label="Resultados de hoy">
          {[
            [remaining.length, "Pendientes"],
            [completed, "Realizados"],
            [moved, "Reprogramados"],
            [unanswered, "Sin respuesta"],
          ].map(([value, label]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{history.loading || history.error ? "—" : value}</dd>
            </div>
          ))}
        </dl>
        <p className="rails-admin-note">
          <LockKeyhole size={14} aria-hidden="true" /> Tu administrador mantiene
          las reglas. Tú decides el resultado de cada contacto.
        </p>
      </div>
      {demo && (
        <p className="rails-notice">
          Demostración · los resultados no se guardan.
        </p>
      )}
      {history.loading && (
        <div className="rails-loading" role="status">
          <p>Verificando tus resultados…</p>
          <div aria-hidden="true" className="rails-skeleton" />
          <div aria-hidden="true" className="rails-skeleton" />
        </div>
      )}
      {history.error && (
        <div role="alert" className="rails-notice rails-error">
          <p>{history.error}</p>
          <button className="rails-button" onClick={load}>
            Reintentar
          </button>
        </div>
      )}
      {notice && (
        <p role="status" className="rails-notice">
          {notice}
        </p>
      )}
      {!history.loading && !history.error && (
        <>
          {batchTotal > 0 && (
            <div className="rails-list-heading">
              <h3>Tu lista de hoy</h3>
              <span>
                {batchDone} de {batchTotal} resueltas
              </span>
              <progress
                aria-label="Avance de esta lista"
                max={batchTotal}
                value={batchDone}
              />
            </div>
          )}
          <div className="rails-worklist">
            {visible.map((action) => (
              <Tarjeta
                key={action.leadId}
                action={action}
                index={batch.indexOf(action.leadId) + 1}
                count={batch.length}
                expanded={activeActionId === action.leadId}
                select={() => {
                  focusAfterResult.current = true;
                  setActiveId(action.leadId);
                }}
                finish={finish}
                move={onMover}
                open={onAbrirCliente}
                demo={demo}
                report={setNotice}
              />
            ))}
          </div>
          {!visible.length && (
            <div className="rails-empty">
              <CheckCircle2 size={32} aria-hidden="true" />
              <h3 tabIndex={-1} data-rails-current>
                {outside.length
                  ? "Esta lista está resuelta"
                  : "Sin acciones pendientes para hoy"}
              </h3>
              <p className="rails-muted">
                {outside.length
                  ? `Todavía hay ${outside.length} clientes por atender. Continúa con la siguiente lista cuando estés listo.`
                  : "Las acciones con fecha futura aparecerán cuando corresponda. Puedes consultar tu cartera en Todos mis clientes."}
              </p>
              {outside.length > 0 && (
                <button
                  className="rails-button rails-primary"
                  onClick={() => {
                    focusAfterResult.current = true;
                    setBatch(remaining.slice(0, limit).map((a) => a.leadId));
                  }}
                >
                  Abrir siguiente lista ({Math.min(outside.length, limit)}){" "}
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
          {visible.length > 0 && outside.length > 0 && (
            <p className="rails-queue-note">
              {outside.length} acciones adicionales. Al terminar, podrás abrir
              la siguiente lista.
            </p>
          )}
        </>
      )}
    </section>
  );
}
function Tarjeta({
  action,
  index,
  count,
  expanded,
  select,
  finish,
  move,
  open,
  demo,
  report,
}) {
  const cardId = useId();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState("");
  const [moving, setMoving] = useState(false);
  // Guidance is an internal instruction, never prefilled as a message to the customer.
  const contact = hrefDelCanal(action.canal, action.telefono);
  const run = async (state, days) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      if (days) {
        const result = await move?.(action, days);
        if (!result?.ok)
          throw new Error(
            result?.error ||
              "No se confirmó la nueva fecha. El cliente sigue pendiente.",
          );
        // Date is durable independently of agenda; report partial success honestly.
        try {
          await finish(action, "movido", `Retomar: ${result.fecha}`);
        } catch {
          throw new Error(
            "La nueva fecha quedó guardada, pero no se confirmó el resultado del día. Revisa la ficha; no vuelvas a moverlo para corregir el historial.",
          );
        }
      } else
        await finish(
          action,
          state,
          state === "saltado" ? "No contestó" : "Acción realizada",
        );
    } catch (e) {
      setError(e.message);
      report(e.message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <article
      className={`rails-client ${expanded ? "is-current" : ""}`}
      aria-busy={busy}
      aria-labelledby={`${cardId}-name`}
    >
      {expanded ? (
        <div className="rails-client-heading">
          <span
            className="rails-step"
            aria-label={`Acción ${index} de ${count}`}
          >
            {index}
          </span>
          <div>
            <h3 id={`${cardId}-name`} tabIndex={-1} data-rails-current>
              {action.nombre}
            </h3>
            <p className="rails-client-meta">
              {action.etapa} ·{" "}
              {action.canal === "whatsapp" ? "WhatsApp" : "Llamada"}
            </p>
          </div>
          <span className="rails-current-label">En foco</span>
        </div>
      ) : (
        <button
          className="rails-client-row"
          aria-expanded={false}
          aria-controls={`${cardId}-body`}
          onClick={select}
        >
          <span
            className="rails-step"
            aria-label={`Acción ${index} de ${count}`}
          >
            {index}
          </span>
          <span className="rails-row-copy">
            <span id={`${cardId}-name`} className="rails-row-name">
              {action.nombre}
            </span>
            <span className="rails-client-meta">
              {action.etapa} ·{" "}
              {action.canal === "whatsapp" ? "WhatsApp" : "Llamada"}
            </span>
          </span>
          <span className="rails-row-action">Atender</span>
          <ChevronDown size={18} aria-hidden="true" />
        </button>
      )}
      <div
        id={`${cardId}-body`}
        hidden={!expanded}
        className="rails-client-body"
      >
        <p className="rails-reason">{action.razon}</p>
        <div className="rails-objective">
          <h4>Qué conseguir</h4>
          <p>{action.pedir}</p>
        </div>
        {!contact && (
          <p className="rails-muted">
            Falta un teléfono válido. Abre la ficha para completarlo.
          </p>
        )}
        <div className="rails-actions rails-contact-actions">
          {contact && !demo && (
            <a
              className="rails-button rails-primary"
              href={contact.href}
              {...(contact.externo
                ? { target: "_blank", rel: "noreferrer" }
                : {})}
            >
              {action.canal === "whatsapp" ? (
                <MessageCircle size={17} aria-hidden="true" />
              ) : (
                <Phone size={17} aria-hidden="true" />
              )}
              {action.canal === "whatsapp" ? "Abrir WhatsApp" : "Llamar"}
            </a>
          )}
          <button
            className={`rails-button ${!contact ? "rails-primary" : "rails-quiet"}`}
            onClick={() => open?.(action.leadId)}
          >
            {!contact ? "Completar teléfono" : "Ver ficha y siguiente paso"}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
        <fieldset disabled={busy} className="rails-results">
          <legend>Después del contacto</legend>
          <div className="rails-actions">
            <button className="rails-button" onClick={() => run("hecho")}>
              <Check size={17} aria-hidden="true" /> Realizado
            </button>
            <button className="rails-button" onClick={() => run("saltado")}>
              No contestó
            </button>
            <button
              className="rails-button"
              aria-expanded={moving}
              aria-controls={`${cardId}-reschedule`}
              onClick={() => setMoving(!moving)}
            >
              <CalendarClock size={17} aria-hidden="true" /> Reprogramar
            </button>
          </div>
          <div
            id={`${cardId}-reschedule`}
            hidden={!moving}
            className="rails-reschedule"
          >
            <p>¿Cuándo lo retomas?</p>
            <p className="rails-muted">
              Se guardará a las 9:00, hora de este dispositivo. Para otra hora,
              abre la ficha.
            </p>
            <div className="rails-actions">
              {[
                [1, "Mañana"],
                [3, "En 3 días"],
                [7, "En una semana"],
              ].map(([days, label]) => (
                <button
                  className="rails-button"
                  key={days}
                  onClick={() => run("movido", days)}
                >
                  {label}
                </button>
              ))}
              <button
                className="rails-button rails-quiet"
                onClick={() => setMoving(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </fieldset>
        {busy && (
          <p role="status" className="rails-saving">
            Guardando resultado…
          </p>
        )}
        {error && (
          <p role="alert" className="rails-notice rails-error">
            {error}
          </p>
        )}
      </div>
    </article>
  );
}
