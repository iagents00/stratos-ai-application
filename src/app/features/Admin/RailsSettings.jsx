/** Admin publishes the process; sellers only execute it. See docs/operacion/RIELES.md. */
import { useState } from "react";
import { ChevronDown, Check, RotateCcw } from "lucide-react";
import { P, font } from "../../../design-system/tokens";
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
    <section
      className="rails-surface"
      style={{
        "--rails-text": T.txt,
        "--rails-muted": T.txt2,
        "--rails-accent": T.accent,
        "--rails-border": T.border,
        "--rails-bg": T.surface || T.bg,
        fontFamily: font,
      }}
    >
      <h2>Ventas sobre Rieles</h2>
      <p className="rails-muted">
        Define qué debe atender tu equipo y cómo hacerlo. Solo los
        administradores pueden cambiar este proceso.
      </p>
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
  return (
    <>
      <div className="rails-status" role="status">
        Proceso vigente:{" "}
        <strong>{store.cfg.activo ? "Activo" : "Inactivo"}</strong>
        {dirty && <span> · Borrador sin publicar</span>}
      </div>
      {remoteChanged && (
        <p role="alert" className="rails-notice">
          La configuración vigente cambió. Tu borrador se conserva; descártalo
          para cargar la versión actual antes de publicar.
        </p>
      )}
      <fieldset disabled={store.guardando} className="rails-fieldset">
        <legend>1. Prepara la lista del equipo</legend>
        <label className="rails-check">
          <input
            type="checkbox"
            checked={draft.activo}
            onChange={(e) => change({ activo: e.target.checked })}
          />{" "}
          Mostrar Mi Día al abrir el CRM
        </label>
        <p className="rails-muted">
          El vendedor ve sus acciones sugeridas y puede consultar todos sus
          clientes sin alterar estas reglas.
        </p>
        <label className="rails-field">
          Acciones por lista
          <select
            value={draft.maxTarjetas}
            onChange={(e) => change({ maxTarjetas: Number(e.target.value) })}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
                {n === 7 ? " · recomendado" : ""}
              </option>
            ))}
          </select>
        </label>
        <p className="rails-muted">
          Empieza con siete. Si hay más pendientes, el vendedor puede abrir la
          siguiente lista.
        </p>
      </fieldset>
      <fieldset disabled={store.guardando} className="rails-fieldset">
        <legend>2. Ajusta las instrucciones</legend>
        <p className="rails-muted">
          {catalogo.filter((r) => draft.reglas[r.tipo].activa).length} de{" "}
          {catalogo.length} reglas activas. Cada una explica por qué atender al
          cliente y qué conseguir.
        </p>
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
                    {rule.fija && <small> · Siempre activa</small>}
                  </span>
                  <ChevronDown size={18} />
                </button>
              </div>
              {expanded && (
                <div id={`rule-${rule.tipo}`} className="rails-rule-body">
                  <p className="rails-muted">{rule.cuando}</p>
                  <label className="rails-field">
                    Por qué aparece hoy
                    <textarea
                      maxLength={600}
                      rows={3}
                      placeholder={rule.razonDefault}
                      value={val.razon || ""}
                      onChange={(e) =>
                        changeRule(rule.tipo, { razon: e.target.value || null })
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
                        changeRule(rule.tipo, { pedir: e.target.value || null })
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
                    Los valores más altos aparecen primero. Puedes usar:{" "}
                    {FICHAS_DISPONIBLES.map((f) => `{${f}}`).join(", ")}.
                  </p>
                  <button
                    onClick={() =>
                      changeRule(rule.tipo, {
                        razon: null,
                        pedir: null,
                        peso: rule.peso,
                      })
                    }
                  >
                    <RotateCcw size={16} /> Restablecer esta instrucción
                  </button>
                  <aside
                    className="rails-preview"
                    aria-label="Vista previa para el vendedor"
                  >
                    <h3>Así lo verá el vendedor</h3>
                    <p className="rails-muted">
                      Ejemplo ilustrativo · no modifica clientes
                    </p>
                    <strong>Cliente de ejemplo</strong>
                    <p>
                      {val.razon
                        ? interpolar(val.razon, example)
                        : rule.razonDefault}
                    </p>
                    <p>
                      <strong>Qué conseguir:</strong>{" "}
                      {val.pedir
                        ? interpolar(val.pedir, example)
                        : rule.pedirDefault}
                    </p>
                    {!val.activa && (
                      <p>Esta regla está desactivada en tu borrador.</p>
                    )}
                  </aside>
                </div>
              )}
            </div>
          );
        })}
      </fieldset>
      <div className="rails-publish">
        <h3>3. Publica cuando esté listo</h3>
        <p className="rails-muted">
          Se aplicará a todo tu equipo. Los vendedores podrán registrar
          resultados y fechas, pero no cambiar la configuración.
        </p>
        <div className="rails-actions">
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
            <Check size={17} />{" "}
            {store.guardando
              ? "Publicando…"
              : "Publicar proceso para el equipo"}
          </button>
          <button disabled={!dirty || store.guardando} onClick={discard}>
            Descartar borrador
          </button>
        </div>
        {status && <p role="status">{status}</p>}
      </div>
    </>
  );
}
