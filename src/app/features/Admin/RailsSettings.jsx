/** Admin publishes the process; sellers only execute it. See docs/operacion/RIELES.md. */
import { useState } from "react";
import {
  ChevronDown,
  Check,
  RotateCcw,
  LockKeyhole,
  Eye,
  ArrowRight,
} from "lucide-react";
import { P } from "../../../design-system/tokens";
import {
  catalogoDeReglas,
  interpolar,
  normalizarLead,
} from "../../../lib/next-action-engine";
import { fusionarRails, FICHAS_DISPONIBLES } from "../../../lib/rails-config";
import { puedeConfigurarRails } from "../../../lib/rails-store";
import { useRailsConfig } from "../../../hooks/useRailsConfig";
import { useAuth } from "../../../hooks/useAuth";
import "./Rails.css";
import { railsTheme } from "./rails-theme";
const catalogo = catalogoDeReglas();
const example = normalizarLead({
  n: "Cliente de ejemplo",
  st: "Seguimiento",
  daysInactive: 3,
  presupuesto: 0,
});
export default function RailsSettings({ T = P }) {
  const { user } = useAuth();
  const store = useRailsConfig();
  if (!puedeConfigurarRails(user))
    return (
      <p role="status">
        Tu administrador configura el proceso de ventas. Tú puedes trabajar tu
        lista desde el CRM.
      </p>
    );
  if (store.cargando)
    return <p role="status">Cargando el proceso de tu equipo…</p>;
  return (
    <section className="rails-surface" style={railsTheme(T)}>
      <header className="rails-settings-header">
        <h2>Ventas sobre Rieles</h2>
        <p className="rails-muted">
          Define qué debe atender tu equipo y cómo hacerlo. Solo los
          administradores pueden cambiar este proceso.
        </p>
        <span className="rails-access-label">
          <LockKeyhole size={14} aria-hidden="true" /> Solo administradores
        </span>
      </header>
      {store.error && (
        <div role="alert" className="rails-notice">
          {store.error}{" "}
          <button onClick={store.recargar}>Reintentar lectura</button>
        </div>
      )}
      {store.sinBase && (
        <p className="rails-notice">
          Demostración: puedes preparar y revisar un borrador. No se publicará
          para ningún equipo.
        </p>
      )}
      {(store.cargada || store.sinBase) && (
        <Editor key={user?.organizationId || "demo"} store={store} />
      )}
    </section>
  );
}
function Editor({ store }) {
  const [base, setBase] = useState(store.cfg);
  const [draft, setDraft] = useState(store.cfg);
  const [open, setOpen] = useState(catalogo[0].tipo);
  const [status, setStatus] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(base);
  const remoteChanged = JSON.stringify(base) !== JSON.stringify(store.cfg);
  const change = (patch) => {
    setDraft((d) => ({ ...d, ...patch }));
    setStatus("");
  };
  const changeRule = (type, patch) => {
    setDraft((d) => ({
      ...d,
      reglas: { ...d.reglas, [type]: { ...d.reglas[type], ...patch } },
    }));
    setStatus("");
  };
  const publish = async () => {
    setStatus("");
    const result = await store.guardar(draft, base);
    if (result.ok) {
      const saved = fusionarRails(draft);
      setDraft(saved);
      setBase(saved);
      setStatus(
        "Publicado. El equipo recibirá el proceso al volver a la app o en la siguiente actualización.",
      );
    } else setStatus(result.error);
  };
  const discard = () => {
    setBase(store.cfg);
    setDraft(store.cfg);
    setStatus("Borrador descartado.");
  };
  const previewRule = catalogo.find((r) => r.tipo === open) || catalogo[0];
  const previewValue = draft.reglas[previewRule.tipo];
  return (
    <>
      <div className="rails-status" role="status">
        <span
          className={`rails-status-badge ${store.cfg.activo ? "is-active" : ""}`}
        >
          Proceso {store.cfg.activo ? "activo" : "inactivo"}
        </span>
        <span className="rails-muted">
          {dirty ? "Borrador sin publicar" : "Sin cambios pendientes"}
        </span>
      </div>
      {remoteChanged && (
        <p role="alert" className="rails-notice">
          La configuración vigente cambió. Tu borrador se conserva; descártalo
          para cargar la versión actual antes de publicar.
        </p>
      )}
      <div className="rails-editor-layout">
        <div className="rails-editor-fields">
          <fieldset disabled={store.guardando} className="rails-fieldset">
            <legend>1. Prepara la lista del equipo</legend>
            <div className="rails-settings-group">
              <label className="rails-setting-row">
                <span>
                  <strong>Mi Día al abrir el CRM</strong>
                  <small>El vendedor empieza con sus acciones sugeridas.</small>
                </span>
                <input
                  className="rails-switch"
                  role="switch"
                  type="checkbox"
                  checked={draft.activo}
                  onChange={(e) => change({ activo: e.target.checked })}
                />
              </label>
              <label className="rails-setting-row">
                <span>
                  <strong>Acciones por lista</strong>
                  <small>
                    Empieza con siete. Los pendientes restantes forman la
                    siguiente lista.
                  </small>
                </span>
                <select
                  value={draft.maxTarjetas}
                  onChange={(e) =>
                    change({ maxTarjetas: Number(e.target.value) })
                  }
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                      {n === 7 ? " · recomendado" : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>
          <fieldset disabled={store.guardando} className="rails-fieldset">
            <legend>2. Ajusta las instrucciones</legend>
            <p className="rails-muted">
              {catalogo.filter((r) => draft.reglas[r.tipo].activa).length} de{" "}
              {catalogo.length} reglas activas. Abre una para ajustar el mensaje
              y su prioridad.
            </p>
            <div className="rails-settings-group">
              {catalogo.map((rule) => {
                const val = draft.reglas[rule.tipo];
                const expanded = open === rule.tipo;
                return (
                  <div className="rails-rule" key={rule.tipo}>
                    <div className="rails-rule-heading">
                      <label className="rails-toggle">
                        <input
                          aria-label={`Activar ${rule.label}`}
                          type="checkbox"
                          checked={val.activa}
                          disabled={rule.fija}
                          onChange={(e) =>
                            changeRule(rule.tipo, { activa: e.target.checked })
                          }
                        />
                      </label>
                      <button
                        aria-expanded={expanded}
                        aria-controls={`rule-${rule.tipo}`}
                        onClick={() => setOpen(expanded ? null : rule.tipo)}
                      >
                        <span>
                          {rule.label}
                          <small>
                            {rule.fija
                              ? "Siempre activa"
                              : val.activa
                                ? `Prioridad ${val.peso}`
                                : "Desactivada"}
                          </small>
                        </span>
                        <ChevronDown size={18} aria-hidden="true" />
                      </button>
                    </div>
                    <div
                      id={`rule-${rule.tipo}`}
                      hidden={!expanded}
                      className="rails-rule-body"
                    >
                      <p className="rails-muted">{rule.cuando}</p>
                      <label className="rails-field">
                        Por qué aparece hoy
                        <textarea
                          maxLength={600}
                          rows={3}
                          placeholder={rule.razonDefault}
                          value={val.razon || ""}
                          onChange={(e) =>
                            changeRule(rule.tipo, {
                              razon: e.target.value || null,
                            })
                          }
                        />
                      </label>
                      <label className="rails-field">
                        Qué debe conseguir el vendedor
                        <textarea
                          maxLength={600}
                          rows={3}
                          placeholder={rule.pedirDefault}
                          value={val.pedir || ""}
                          onChange={(e) =>
                            changeRule(rule.tipo, {
                              pedir: e.target.value || null,
                            })
                          }
                        />
                      </label>
                      <label className="rails-field">
                        Prioridad · 0 a 100
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={val.peso}
                          onChange={(e) =>
                            changeRule(rule.tipo, {
                              peso: Math.min(
                                100,
                                Math.max(0, Number(e.target.value)),
                              ),
                            })
                          }
                        />
                      </label>
                      <p className="rails-muted">
                        Los valores más altos aparecen primero.
                      </p>
                      <details className="rails-help">
                        <summary>Personalizar con datos del cliente</summary>
                        <p className="rails-muted">
                          Escribe estas fichas en una instrucción. Se reemplazan
                          con los datos del cliente:{" "}
                          {FICHAS_DISPONIBLES.map((f) => `{${f}}`).join(", ")}.
                        </p>
                      </details>
                      <button
                        className="rails-quiet"
                        onClick={() =>
                          changeRule(rule.tipo, {
                            razon: null,
                            pedir: null,
                            peso: rule.peso,
                          })
                        }
                      >
                        <RotateCcw size={16} aria-hidden="true" /> Restablecer
                        esta instrucción
                      </button>
                      {expanded && (
                        <div className="rails-inline-preview">
                          <VistaPrevia rule={rule} value={val} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </fieldset>
        </div>
        <aside
          className="rails-preview"
          aria-label="Vista previa para el vendedor"
        >
          <VistaPrevia rule={previewRule} value={previewValue} />
        </aside>
      </div>
      <div className="rails-publish">
        <div>
          <h3>3. Publica cuando esté listo</h3>
          <p className="rails-muted">
            {dirty
              ? "Tus cambios aún no se aplican al equipo."
              : "El proceso vigente se mantiene hasta que publiques cambios."}
          </p>
        </div>
        <div className="rails-actions">
          <button disabled={!dirty || store.guardando} onClick={discard}>
            Descartar borrador
          </button>
          <button
            className="rails-primary"
            disabled={
              !dirty ||
              !store.puedeGuardar ||
              store.guardando ||
              !!store.error ||
              remoteChanged
            }
            onClick={publish}
          >
            <Check size={17} aria-hidden="true" />
            {store.guardando
              ? "Publicando…"
              : "Publicar proceso para el equipo"}
          </button>
        </div>
        {status && (
          <p role="status" className="rails-publish-status">
            {status}
          </p>
        )}
      </div>
    </>
  );
}

function VistaPrevia({ rule, value }) {
  return (
    <>
      <h3>
        <Eye size={18} aria-hidden="true" /> Así lo verá el vendedor
      </h3>
      <p className="rails-muted">Ejemplo ilustrativo · no modifica clientes</p>
      <div className="rails-preview-content">
        <span className="rails-client-meta">{rule.label}</span>
        <h4>Cliente de ejemplo</h4>
        <p className="rails-reason">
          {value.razon ? interpolar(value.razon, example) : rule.razonDefault}
        </p>
        <div className="rails-objective">
          <h4>Qué conseguir</h4>
          <p>
            {value.pedir ? interpolar(value.pedir, example) : rule.pedirDefault}
          </p>
        </div>
        <p className="rails-preview-link" aria-hidden="true">
          Ver ficha y siguiente paso <ArrowRight size={16} />
        </p>
      </div>
      {!value.activa && (
        <p className="rails-notice">
          Esta regla está desactivada en tu borrador.
        </p>
      )}
      <p className="rails-admin-note">
        <LockKeyhole size={14} aria-hidden="true" /> El vendedor registra
        resultados. La configuración permanece en manos del administrador.
      </p>
    </>
  );
}
