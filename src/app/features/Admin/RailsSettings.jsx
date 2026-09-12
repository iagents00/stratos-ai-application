/** Configuración de Stratos Rails. Los controles editan un borrador por organización. */
import { useState, useMemo, useId } from "react";
import { ChevronDown, RotateCcw, Check, ExternalLink, Minus, Plus } from "lucide-react";
import { P, LP, font } from "../../../design-system/tokens";
import { catalogoDeReglas } from "../../../lib/next-action-engine";
import { FICHAS_DISPONIBLES } from "../../../lib/rails-config";
import { useRailsConfig } from "../../../hooks/useRailsConfig";
import "./RailsSettings.css";

export default function RailsSettings({ T = P, isLight = false }) {
  const config = useRailsConfig();
  return <PanelProceso key={config.scope} T={T} isLight={isLight} config={config} />;
}

function PanelProceso({ T, isLight, config }) {
  const { cfg: guardada, cargando, guardar, puedeGuardar, guardando, error, recargar, demo } = config;
  const [borrador, setBorrador] = useState(null);
  const cfg = borrador || guardada;
  const sucio = cfg !== guardada;
  const catalogo = useMemo(() => catalogoDeReglas(), []);
  const [abierta, setAbierta] = useState(null);
  const [estado, setEstado] = useState("");
  const bloqueado = cargando || guardando || !puedeGuardar || !!error;

  function aplicar(cambio) {
    setBorrador(actual => {
      const base = actual || guardada;
      return typeof cambio === "function" ? cambio(base) : { ...base, ...cambio };
    });
    setEstado("");
  }
  async function guardarCambios() {
    setEstado("guardando");
    const r = await guardar(cfg);
    setEstado(r.ok ? "ok" : (r.error || "No se pudo guardar"));
    if (r.ok) setBorrador(null);
  }
  function descartar() { setBorrador(null); setEstado(""); }
  const cambiarRegla = (tipo, parche) => aplicar(c => ({ ...c, reglas: { ...c.reglas, [tipo]: { ...c.reglas[tipo], ...parche } } }));
  const activas = catalogo.filter(r => cfg.reglas[r.tipo]?.activa !== false).length;
  const fallo = estado && !["ok", "guardando"].includes(estado);
  const mensaje = cargando ? "Cargando configuración…" : guardando ? "Guardando…" : estado === "ok"
    ? (demo ? "Demo actualizada en esta sesión." : "Guardado. Tu equipo lo ve en su siguiente carga.")
    : sucio ? "Cambios sin guardar" : "Sin cambios pendientes";

  return (
    <section className="rails-settings" data-theme={isLight ? "light" : "dark"} aria-labelledby="proceso-titulo" style={{
      "--process-text": T.txt, "--process-secondary": T.txt2,
      "--process-canvas": T.bg, "--process-surface": isLight ? T.surface : T.bg2 || P.bg2,
      "--process-hover": T.glassH, "--process-border": T.borderH || T.border,
      "--process-accent": isLight ? T.accentDark || LP.accentDark : T.accent,
      "--process-accent-soft": T.accentS, "--process-error": T.rose,
      "--process-ink": isLight ? LP.surface : P.bg, fontFamily: font,
    }}>
      <header className="process-heading">
        <div><h1 id="proceso-titulo">Stratos Rails</h1><p>Configura las reglas y la lista del día de tu equipo.</p></div>
        <a className="process-button process-preview" href="/?app&rails=1" target="_blank" rel="noreferrer">
          <ExternalLink size={16} aria-hidden="true" /> Vista previa <span className="process-sr-only">en una pestaña nueva, sin activar Rails para el equipo</span>
        </a>
      </header>

      {demo && <Aviso>Modo demo: los cambios duran esta sesión y se restablecen al recargar.</Aviso>}
      {error && <Aviso error>No se pudo leer la configuración: {error}<button className="process-button" onClick={recargar}>Recargar configuración</button></Aviso>}
      {fallo && <Aviso error>{estado}<button className="process-button" onClick={() => { descartar(); recargar(); }}>Descartar borrador y recargar configuración</button></Aviso>}
      {!puedeGuardar && <Aviso>Sin conexión: vuelve a conectarte para editar el proceso.</Aviso>}

      <fieldset className="process-layout" disabled={bloqueado} aria-busy={cargando || guardando}>
        <legend className="process-sr-only">Configuración del proceso comercial</legend>
        <div className="process-general">
          <section className="process-section" aria-labelledby="process-activation">
            <div className="process-section-title"><h2 id="process-activation">Activar para el equipo</h2><Interruptor activo={cfg.activo} nombre="Activar Stratos Rails" onChange={activo => aplicar({ activo })} /></div>
            <span className="process-state" data-active={cfg.activo}>{cargando ? "Cargando…" : cfg.activo ? "Activado" : "Desactivado"}{sucio && " · Borrador"}</span>
            <p>{cfg.activo
              ? `Tu equipo abre el CRM y ve su lista del día: bloques de ${cfg.maxTarjetas} ${cfg.maxTarjetas === 1 ? "acción" : "acciones"}, con el pipeline completo a un clic.`
              : "Apagado, el CRM se ve exactamente como siempre. Prenderlo le cambia la pantalla de entrada a todo el equipo."}</p>
          </section>
          <section className="process-section" aria-labelledby="process-block">
            <h2 id="process-block">Acciones por bloque</h2>
            <p>Siete por bloque de forma predeterminada. Al guardar una gestión aparece el siguiente cliente; el total pendiente siempre queda visible.</p>
            <Contador valor={cfg.maxTarjetas} min={1} max={12} nombre="acciones por bloque" onChange={maxTarjetas => aplicar({ maxTarjetas })} />
          </section>
        </div>
        <section className="process-rules" aria-labelledby="process-rules-title">
          <div className="process-rules-heading"><h2 id="process-rules-title">Reglas del proceso</h2><span>{activas} de {catalogo.length} activas</span></div>
          <p>Cada regla decide por qué un cliente aparece hoy y qué hay que conseguir con él. Apaga las que no apliquen a tu negocio y escribe los textos con tu voz.</p>
          <div className="process-rule-list">
            {catalogo.map(r => <FilaRegla key={r.tipo} regla={r} valor={cfg.reglas[r.tipo] || {}} abierta={abierta === r.tipo}
              onAbrir={() => setAbierta(a => a === r.tipo ? null : r.tipo)} onCambio={parche => cambiarRegla(r.tipo, parche)} />)}
          </div>
        </section>
      </fieldset>

      <footer className="process-savebar">
        <p role="status" data-success={estado === "ok"}>{estado === "ok" && <Check size={17} aria-hidden="true" />}{mensaje}</p>
        <div className="process-save-actions">
          {sucio && <button className="process-button" disabled={guardando} onClick={descartar}>Descartar cambios</button>}
          <button className="process-button process-primary" disabled={!sucio || bloqueado} onClick={guardarCambios}>{guardando ? "Guardando…" : "Guardar cambios del proceso"}</button>
        </div>
      </footer>
    </section>
  );
}

function FilaRegla({ regla, valor, abierta, onAbrir, onCambio }) {
  const activa = valor.activa !== false;
  const personalizada = !!(valor.razon || valor.pedir) || (valor.peso != null && valor.peso !== regla.peso);
  return (
    <div className="process-rule" data-active={activa} data-open={abierta}>
      <div className="process-rule-row">
        <Interruptor activo={activa} nombre={`Activar ${regla.label}`} deshabilitado={regla.fija}
          titulo={regla.fija ? "Esta regla es la red de seguridad y no se puede apagar" : undefined} onChange={activa => onCambio({ activa })} />
        <button className="process-rule-disclosure" aria-expanded={abierta} aria-controls={`rails-regla-${regla.tipo}`} onClick={onAbrir}>
          <span className="process-rule-copy"><span className="process-rule-name">{regla.label}{personalizada && <small>Tu versión</small>}{regla.fija && <small>Siempre activa</small>}{!activa && <small>Desactivada</small>}</span><span className="process-rule-description">{regla.cuando}</span></span>
          <ChevronDown size={18} aria-hidden="true" />
        </button>
      </div>
      {abierta && <div id={`rails-regla-${regla.tipo}`} className="process-rule-editor">
        <Campo etiqueta="Por qué aparece hoy" ayuda="La línea grande de la tarjeta. Es lo que el asesor lee primero." valor={valor.razon || ""} marca={regla.razonDefault} onCambio={razon => onCambio({ razon })} />
        <Campo etiqueta="Qué hay que conseguir" ayuda="La instrucción concreta, en verde debajo de la razón." valor={valor.pedir || ""} marca={regla.pedirDefault} onCambio={pedir => onCambio({ pedir })} />
        <div className="process-priority"><div><h3>Prioridad</h3><p>Más alto sube en la lista. De fábrica: {regla.peso}.</p></div><Contador valor={valor.peso ?? regla.peso} nombre={`prioridad de ${regla.label}`} min={0} max={100} paso={5} onChange={peso => onCambio({ peso })} /></div>
        <p>Puedes usar {FICHAS_DISPONIBLES.map(f => `{${f}}`).join(" ")} y se reemplazan solas. Deja un campo vacío para volver al texto de fábrica.</p>
      </div>}
    </div>
  );
}

function Campo({ etiqueta, ayuda, valor, marca, onCambio }) {
  const id = useId();
  return <div className="process-field"><div className="process-field-heading"><label htmlFor={id}>{etiqueta}</label>{valor && <button className="process-reset" onClick={() => onCambio("")}><RotateCcw size={14} aria-hidden="true" />Volver al de fábrica</button>}</div><p id={`${id}-ayuda`}>{ayuda}</p><textarea id={id} aria-describedby={`${id}-ayuda`} maxLength={1000} value={valor} onChange={e => onCambio(e.target.value)} rows={3} placeholder={marca} /></div>;
}
function Interruptor({ nombre, activo, onChange, deshabilitado, titulo }) {
  return <button className="process-switch" role="switch" aria-label={nombre} aria-checked={activo} title={titulo} disabled={deshabilitado} onClick={() => onChange(!activo)}><span className="process-switch-track" aria-hidden="true"><span /></span></button>;
}
function Contador({ nombre, valor, min, max, paso = 1, onChange }) {
  return <div className="process-counter" role="group" aria-label={nombre}><button aria-label={`Reducir ${nombre}`} disabled={valor <= min} onClick={() => onChange(Math.max(min, valor - paso))}><Minus size={17} aria-hidden="true" /></button><output aria-live="polite" aria-label={nombre}>{valor}</output><button aria-label={`Aumentar ${nombre}`} disabled={valor >= max} onClick={() => onChange(Math.min(max, valor + paso))}><Plus size={17} aria-hidden="true" /></button></div>;
}
function Aviso({ children, error }) {
  return <div className="process-notice" role={error ? "alert" : "status"} data-error={!!error}>{children}</div>;
}
