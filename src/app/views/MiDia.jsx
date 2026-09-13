/** Seller workspace. A result is completed only after the server acknowledges it. */
import { useState, useMemo, useEffect, useRef } from "react";
import {
  Phone,
  MessageCircle,
  Check,
  CalendarClock,
  Plus,
  LayoutGrid,
} from "lucide-react";
import { P, LP, font } from "../../design-system/tokens";
import { listaDelDia, proximaAccion } from "../../lib/next-action-engine";
import { hrefDelCanal } from "../../lib/telefono";
import { agendaDeHoy, marcarAccion } from "../../lib/agenda";
import { useAuth } from "../../hooks/useAuth";
import "../features/Admin/Rails.css";
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
      className="rails-day"
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "8px 0 28px",
        color: T.txt,
        fontFamily: font,
        "--rails-accent": T.accent,
      }}
    >
      <header style={{ marginBottom: 24 }}>
        <h2
          style={{ margin: "0 0 8px", fontSize: 28, letterSpacing: "-.02em" }}
        >
          Mi Día
        </h2>
        <p style={{ color: T.txt2, fontSize: 14, lineHeight: 1.6 }}>
          Empieza por el primer cliente, sigue la instrucción y registra el
          resultado. Tu administrador mantiene las reglas del proceso.
        </p>
        <p role="status" style={{ color: T.txt2 }}>
          {history.loading
            ? "Verificando tus resultados…"
            : `${remaining.length} pendientes · ${completed} ${completed === 1 ? "realizado" : "realizados"} · ${moved} ${moved === 1 ? "reprogramado" : "reprogramados"} · ${unanswered} sin respuesta`}
        </p>
        {demo && (
          <p style={{ color: T.txt2 }}>
            Demostración · los resultados no se guardan.
          </p>
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={button(T)} onClick={onNuevoCliente}>
            <Plus size={16} /> Nuevo cliente
          </button>
          <button style={button(T)} onClick={onVerCRM}>
            <LayoutGrid size={16} /> Todos mis clientes
          </button>
        </div>
      </header>
      {history.error && (
        <div role="alert">
          <p>{history.error}</p>
          <button style={button(T)} onClick={load}>
            Reintentar
          </button>
        </div>
      )}
      {notice && (
        <p role="status" style={{ color: T.txt2 }}>
          {notice}
        </p>
      )}
      {!history.loading && !history.error && (
        <>
          {visible.map((action, index) => (
            <Tarjeta
              key={action.leadId}
              action={action}
              index={index + 1}
              count={visible.length}
              T={T}
              finish={finish}
              move={onMover}
              open={onAbrirCliente}
              demo={demo}
              report={setNotice}
            />
          ))}
          {!visible.length && (
            <div
              style={{
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                padding: 24,
              }}
            >
              <h3 style={{ marginTop: 0 }}>
                {outside.length
                  ? "Esta lista está resuelta"
                  : "Sin acciones pendientes para hoy"}
              </h3>
              <p style={{ color: T.txt2 }}>
                {outside.length
                  ? `Todavía hay ${outside.length} clientes por atender. Continúa con la siguiente lista cuando estés listo.`
                  : "Las acciones con fecha futura aparecerán cuando corresponda. Puedes consultar tu cartera en Todos mis clientes."}
              </p>
            </div>
          )}
          {visible.length > 0 && outside.length > 0 && (
            <p style={{ color: T.txt2 }}>
              {outside.length} acciones adicionales. La siguiente lista estará
              disponible al resolver esta.
            </p>
          )}
          {!visible.length && outside.length > 0 && (
            <button
              style={button(T)}
              onClick={() =>
                setBatch(remaining.slice(0, limit).map((a) => a.leadId))
              }
            >
              Abrir siguiente lista ({Math.min(outside.length, limit)})
            </button>
          )}
        </>
      )}
    </section>
  );
}
const button = (T) => ({
  minHeight: 44,
  padding: "10px 14px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  border: `1px solid ${T.border}`,
  borderRadius: 9,
  background: "transparent",
  color: T.txt,
  font: "inherit",
  fontSize: 14,
  cursor: "pointer",
  textDecoration: "none",
});
function Tarjeta({
  action,
  index,
  count,
  T,
  finish,
  move,
  open,
  demo,
  report,
}) {
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
      aria-busy={busy}
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        padding: "20px",
        marginBottom: 16,
        overflowWrap: "anywhere",
      }}
    >
      <p style={{ color: T.txt2, margin: "0 0 6px", fontSize: 13 }}>
        Acción {index} de {count} · {action.etapa} ·{" "}
        {action.canal === "whatsapp" ? "WhatsApp" : "Llamada"}
      </p>
      <h3 style={{ fontSize: 23, margin: "0 0 10px" }}>{action.nombre}</h3>
      <p style={{ fontSize: 16, lineHeight: 1.55, color: T.txt2 }}>
        {action.razon}
      </p>
      <p style={{ fontSize: 15, lineHeight: 1.55 }}>
        <strong>Qué conseguir:</strong> {action.pedir}
      </p>
      {!contact && (
        <p style={{ color: T.txt2 }}>
          Falta un teléfono válido. Abre la ficha para completarlo.
        </p>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {contact && !demo && (
          <a
            href={contact.href}
            {...(contact.externo
              ? { target: "_blank", rel: "noreferrer" }
              : {})}
            style={{
              ...button(T),
              background: T.accent,
              color: "#041016",
              borderColor: "transparent",
            }}
          >
            {action.canal === "whatsapp" ? (
              <MessageCircle size={16} />
            ) : (
              <Phone size={16} />
            )}
            {action.canal === "whatsapp" ? "Abrir WhatsApp" : "Llamar"}
          </a>
        )}
        <button style={button(T)} onClick={() => open?.(action.leadId)}>
          Ver ficha y siguiente paso
        </button>
      </div>
      <fieldset
        disabled={busy}
        style={{ border: 0, padding: 0, margin: "20px 0 0", minWidth: 0 }}
      >
        <legend style={{ marginBottom: 10, fontSize: 14, color: T.txt2 }}>
          Después del contacto
        </legend>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={button(T)} onClick={() => run("hecho")}>
            <Check size={16} /> Realizado
          </button>
          <button style={button(T)} onClick={() => run("saltado")}>
            No contestó
          </button>
          <button
            style={button(T)}
            aria-expanded={moving}
            onClick={() => setMoving(!moving)}
          >
            <CalendarClock size={16} /> Reprogramar
          </button>
        </div>
        {moving && (
          <div style={{ marginTop: 12 }}>
            <p style={{ color: T.txt2 }}>
              ¿Cuándo lo retomas? Se guardará a las 9:00, hora de este
              dispositivo. Para otra hora, abre la ficha.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                [1, "Mañana"],
                [3, "En 3 días"],
                [7, "En una semana"],
              ].map(([days, label]) => (
                <button
                  style={button(T)}
                  key={days}
                  onClick={() => run("movido", days)}
                >
                  {label}
                </button>
              ))}
              <button style={button(T)} onClick={() => setMoving(false)}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </fieldset>
      {busy && <p role="status">Guardando resultado…</p>}
      {error && <p role="alert">{error}</p>}
    </article>
  );
}
