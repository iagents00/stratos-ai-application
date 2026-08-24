/**
 * app/features/Admin/RailsSettings.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * PRENDER, APAGAR Y PERSONALIZAR STRATOS RAILS — sin tocar código.
 *
 * Todo lo que se mueve acá se guarda en `organizations.meta_config.rails` y le
 * llega al equipo en su siguiente carga. No hace falta un deploy para prenderlo,
 * ni para cambiarle un texto, ni para apagar una regla que a esta empresa no le
 * aplica.
 *
 * DECISIONES DE DISEÑO
 * · El interruptor grande está arriba y solo. Es el único control que la mayoría
 *   va a tocar, y prenderlo le reordena la pantalla a todo el equipo de ventas:
 *   merece su propio espacio, no una fila más en una lista de ajustes.
 * · Cada regla se puede apagar, pesar y reescribir. La voz del coach es lo más
 *   específico de cada negocio — "Preséntate y consigue una cosa: para qué quiere
 *   invertir" sirve para una inmobiliaria y no para una constructora.
 * · Los textos de fábrica se muestran de marca de agua. Si el campo está vacío se
 *   usa el del motor, así que dejarlo en blanco es "volver al default" y mañana
 *   una mejora nuestra les llega sola.
 * · `definir_paso` no se puede apagar: es la red de seguridad que evita leads sin
 *   dueño de su futuro, que es el problema que Rails viene a resolver.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useMemo } from "react";
import { ChevronDown, RotateCcw, Check, ExternalLink } from "lucide-react";
import { P, font, fontDisp } from "../../../design-system/tokens";
import { catalogoDeReglas } from "../../../lib/next-action-engine";
import { FICHAS_DISPONIBLES } from "../../../lib/rails-config";
import { useRailsConfig } from "../../../hooks/useRailsConfig";
import { G } from "../../SharedComponents";
import { useIsMobile } from "../../../hooks/useViewport";

export default function RailsSettings({ T = P, isLight = false }) {
  const isMobile = useIsMobile();
  const { cfg, cargando, guardar, puedeGuardar } = useRailsConfig();
  const catalogo = useMemo(() => catalogoDeReglas(), []);

  const [abierta, setAbierta] = useState(null);      // qué regla está desplegada
  const [estado, setEstado] = useState("");          // "guardando" | "ok" | mensaje de error

  const wTxt = isLight ? T.txt : "#FFFFFF";

  async function aplicar(cambio) {
    const siguiente = typeof cambio === "function" ? cambio(cfg) : { ...cfg, ...cambio };
    setEstado("guardando");
    const r = await guardar(siguiente);
    setEstado(r.ok ? "ok" : (r.error || "No se pudo guardar"));
    if (r.ok) setTimeout(() => setEstado((e) => (e === "ok" ? "" : e)), 2000);
  }

  const cambiarRegla = (tipo, parche) =>
    aplicar((c) => ({ ...c, reglas: { ...c.reglas, [tipo]: { ...c.reglas[tipo], ...parche } } }));

  const activas = catalogo.filter((r) => cfg.reglas[r.tipo]?.activa !== false).length;

  return (
    <div style={{ padding: isMobile ? "10px 0 40px" : "28px 28px 40px", maxWidth: 880 }}>
      <G T={T} style={{ padding: isMobile ? 16 : 24 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

        {/* ── El interruptor grande ──
            El switch va en la MISMA fila que el título, no al final de un bloque
            que envuelve: en móvil el flex-wrap lo tiraba solo a la izquierda,
            debajo del párrafo, y dejaba de leerse como el interruptor de "esto
            de aquí arriba". La descripción va abajo, a todo el ancho. */}
        <div>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 12, marginBottom: 6,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", minWidth: 0 }}>
              <h3 style={{
                margin: 0, fontSize: isMobile ? 18 : 20, fontWeight: 500, color: wTxt,
                fontFamily: fontDisp, letterSpacing: "-0.025em",
              }}>Stratos Rails</h3>
              <Pastilla T={T} activo={cfg.activo}>
                {cargando ? "Cargando…" : cfg.activo ? "Prendido" : "Apagado"}
              </Pastilla>
            </div>
            <Interruptor
              T={T} isLight={isLight} activo={cfg.activo} deshabilitado={cargando}
              onChange={(v) => aplicar({ activo: v })}
            />
          </div>
          <p style={{ margin: 0, fontSize: 12.5, color: T.txt3, fontFamily: font, lineHeight: 1.55, maxWidth: 560 }}>
            {cfg.activo
              ? `Tu equipo abre el CRM y ve su lista del día: máximo ${cfg.maxTarjetas} ${cfg.maxTarjetas === 1 ? "acción" : "acciones"}, con el pipeline completo a un clic.`
              : "Apagado, el CRM se ve exactamente como siempre. Prenderlo le cambia la pantalla de entrada a todo el equipo."}
          </p>
        </div>

        {!puedeGuardar && (
          <Aviso T={T}>
            Modo demo: muévele todo lo que quieras y míralo en Mi Día — pero al recargar
            vuelve como estaba, porque no hay organización donde guardarlo.
          </Aviso>
        )}
        {estado && estado !== "ok" && estado !== "guardando" && (
          <Aviso T={T} error>{estado}</Aviso>
        )}

        {/* ── Antes de prenderlo, míralo ── */}
        <a
          href="/?rails=1" target="_blank" rel="noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: 7, alignSelf: "flex-start",
            fontSize: 12.5, fontFamily: font, color: T.accent, textDecoration: "none",
          }}
        >
          <ExternalLink size={13} strokeWidth={2.2} />
          Verlo con tus clientes sin prendérselo al equipo
        </a>

        <Separador T={T} />

        {/* ── Cuántas acciones por día ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ minWidth: 240, flex: 1 }}>
            <p style={{ margin: "0 0 3px", fontSize: 13.5, fontWeight: 500, color: wTxt, fontFamily: font }}>
              Acciones por día
            </p>
            <p style={{ margin: 0, fontSize: 12, color: T.txt3, fontFamily: font, lineHeight: 1.5 }}>
              Siete es el default. Una lista que no se puede terminar deja de ser una lista
              y vuelve a ser el pipeline con otro nombre.
            </p>
          </div>
          <Contador
            T={T} valor={cfg.maxTarjetas} min={1} max={12}
            onChange={(v) => aplicar({ maxTarjetas: v })}
          />
        </div>

        <Separador T={T} />

        {/* ── Las reglas ── */}
        <div>
          <p style={{ margin: "0 0 3px", fontSize: 13.5, fontWeight: 500, color: wTxt, fontFamily: font }}>
            Reglas <span style={{ color: T.txt3, fontWeight: 400 }}>· {activas} de {catalogo.length} activas</span>
          </p>
          <p style={{ margin: "0 0 14px", fontSize: 12, color: T.txt3, fontFamily: font, lineHeight: 1.5 }}>
            Cada regla decide por qué un cliente aparece hoy y qué hay que conseguir con él.
            Apaga las que no apliquen a tu negocio y escribe los textos con tu voz.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {catalogo.map((r) => (
              <FilaRegla
                key={r.tipo}
                T={T} isLight={isLight} wTxt={wTxt} regla={r}
                valor={cfg.reglas[r.tipo] || {}}
                abierta={abierta === r.tipo}
                onAbrir={() => setAbierta((a) => (a === r.tipo ? null : r.tipo))}
                onCambio={(parche) => cambiarRegla(r.tipo, parche)}
              />
            ))}
          </div>
        </div>

        {estado === "guardando" && (
          <p style={{ margin: 0, fontSize: 12, color: T.txt3, fontFamily: font }}>Guardando…</p>
        )}
        {estado === "ok" && (
          <p style={{ margin: 0, fontSize: 12, color: T.accent, fontFamily: font, display: "flex", alignItems: "center", gap: 6 }}>
            <Check size={13} strokeWidth={2.4} /> Guardado. Tu equipo lo ve en su siguiente carga.
          </p>
        )}
      </div>
      </G>
    </div>
  );
}

/* ── Una regla ─────────────────────────────────────────────────────────────── */
function FilaRegla({ T, isLight, wTxt, regla, valor, abierta, onAbrir, onCambio }) {
  const activa = valor.activa !== false;
  const personalizada = !!(valor.razon || valor.pedir) || (valor.peso != null && valor.peso !== regla.peso);

  return (
    <div style={{
      border: `1px solid ${T.border}`, borderRadius: 12,
      background: isLight ? T.surface : "rgba(255,255,255,0.02)",
      opacity: activa ? 1 : 0.55, transition: "opacity 0.2s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
        <Interruptor
          T={T} isLight={isLight} pequeno activo={activa} deshabilitado={regla.fija}
          titulo={regla.fija ? "Esta regla es la red de seguridad y no se puede apagar" : undefined}
          onChange={(v) => onCambio({ activa: v })}
        />
        <button
          onClick={onAbrir}
          style={{
            flex: 1, display: "flex", alignItems: "center", gap: 10, background: "none",
            border: "none", padding: 0, cursor: "pointer", textAlign: "left", minWidth: 0,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: wTxt, fontFamily: font }}>{regla.label}</span>
              {personalizada && <Pastilla T={T} tenue>tu versión</Pastilla>}
              {regla.fija && <Pastilla T={T} tenue>siempre</Pastilla>}
            </div>
            <p style={{
              margin: "2px 0 0", fontSize: 11.5, color: T.txt3, fontFamily: font,
              lineHeight: 1.45,
            }}>{regla.cuando}</p>
          </div>
          <ChevronDown
            size={15} color={T.txt3} strokeWidth={2.2}
            style={{ transform: abierta ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}
          />
        </button>
      </div>

      {abierta && (
        <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
          <Campo
            T={T} isLight={isLight} wTxt={wTxt}
            etiqueta="Por qué aparece hoy"
            ayuda="La línea grande de la tarjeta. Es lo que el asesor lee primero."
            valor={valor.razon || ""} marca={regla.razonDefault}
            onGuardar={(v) => onCambio({ razon: v })}
          />
          <Campo
            T={T} isLight={isLight} wTxt={wTxt}
            etiqueta="Qué hay que conseguir"
            ayuda="La instrucción concreta, en verde debajo de la razón."
            valor={valor.pedir || ""} marca={regla.pedirDefault}
            onGuardar={(v) => onCambio({ pedir: v })}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <p style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 500, color: wTxt, fontFamily: font }}>Prioridad</p>
              <p style={{ margin: 0, fontSize: 11, color: T.txt3, fontFamily: font }}>
                Más alto sube en la lista. De fábrica: {regla.peso}.
              </p>
            </div>
            <Contador
              T={T} valor={valor.peso ?? regla.peso} min={0} max={100} paso={5}
              onChange={(v) => onCambio({ peso: v })}
            />
          </div>
          <p style={{ margin: 0, fontSize: 11, color: T.txt3, fontFamily: font, lineHeight: 1.5 }}>
            Puedes usar {FICHAS_DISPONIBLES.map((f) => `{${f}}`).join(" ")} y se reemplazan solas.
            Deja un campo vacío para volver al texto de fábrica.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Piezas ────────────────────────────────────────────────────────────────── */

/** Textarea que guarda al salir del campo, no en cada tecla. */
function Campo({ T, isLight, wTxt, etiqueta, ayuda, valor, marca, onGuardar }) {
  const [borrador, setBorrador] = useState(valor);
  const sucio = borrador !== valor;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: wTxt, fontFamily: font }}>{etiqueta}</label>
        {valor && (
          <button
            onClick={() => { setBorrador(""); onGuardar(""); }}
            style={{
              display: "flex", alignItems: "center", gap: 4, background: "none", border: "none",
              padding: 0, cursor: "pointer", fontSize: 11, color: T.txt3, fontFamily: font,
            }}
          ><RotateCcw size={11} strokeWidth={2.2} /> volver al de fábrica</button>
        )}
      </div>
      <p style={{ margin: "0 0 6px", fontSize: 11, color: T.txt3, fontFamily: font }}>{ayuda}</p>
      <textarea
        value={borrador}
        onChange={(e) => setBorrador(e.target.value)}
        onBlur={() => { if (sucio) onGuardar(borrador); }}
        rows={2}
        placeholder={marca}
        style={{
          width: "100%", boxSizing: "border-box", resize: "vertical",
          padding: "9px 11px", borderRadius: 9,
          border: `1px solid ${T.border}`,
          background: isLight ? "#FFFFFF" : "rgba(0,0,0,0.25)",
          color: wTxt, fontSize: 12.5, fontFamily: font, lineHeight: 1.5,
          outline: "none",
        }}
      />
    </div>
  );
}

function Interruptor({ T, activo, onChange, deshabilitado, pequeno, titulo, isLight }) {
  const w = pequeno ? 34 : 48, h = pequeno ? 20 : 28, d = h - 6;
  // Un interruptor apagado tiene que verse como interruptor. Con el riel
  // transparente se leía como un borde decorativo —o peor, en claro, como un
  // punto suelto— y nadie lo tocaba. Riel gris neutro apagado, botón blanco con
  // sombra: la convención que la gente ya reconoce de su teléfono.
  const rielApagado = isLight ? "#D8DEE7" : "rgba(255,255,255,0.14)";
  return (
    <button
      role="switch" aria-checked={activo} title={titulo}
      onClick={() => !deshabilitado && onChange(!activo)}
      disabled={deshabilitado}
      style={{
        width: w, height: h, borderRadius: 99, flexShrink: 0, position: "relative",
        border: "none", background: activo ? T.accent : rielApagado,
        cursor: deshabilitado ? "not-allowed" : "pointer",
        opacity: deshabilitado ? 0.45 : 1,
        transition: "background 0.2s", padding: 0,
      }}
    >
      <span style={{
        position: "absolute", top: (h - d) / 2, left: activo ? w - d - 3 : 3,
        width: d, height: d, borderRadius: "50%",
        background: activo ? "#04120D" : "#FFFFFF",
        boxShadow: "0 1px 3px rgba(0,0,0,0.28)",
        transition: "left 0.2s, background 0.2s",
      }} />
    </button>
  );
}

function Contador({ T, valor, min, max, paso = 1, onChange, deshabilitado }) {
  const btn = (etiqueta, delta) => (
    <button
      onClick={() => onChange(Math.min(max, Math.max(min, valor + delta)))}
      disabled={deshabilitado}
      style={{
        width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.border}`,
        background: "transparent", color: T.txt2, fontSize: 15, fontFamily: font,
        cursor: deshabilitado ? "not-allowed" : "pointer", opacity: deshabilitado ? 0.45 : 1,
        display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
      }}
    >{etiqueta}</button>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
      {btn("−", -paso)}
      <span style={{
        minWidth: 30, textAlign: "center", fontSize: 15, fontWeight: 600,
        color: T.txt, fontFamily: fontDisp,
      }}>{valor}</span>
      {btn("+", paso)}
    </div>
  );
}

function Pastilla({ T, children, activo, tenue }) {
  const color = tenue ? T.txt3 : activo ? T.accent : T.txt3;
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 500, fontFamily: font, color,
      background: tenue ? "transparent" : activo ? "rgba(110,231,194,0.10)" : T.glass,
      border: `1px solid ${tenue ? T.border : activo ? "rgba(110,231,194,0.28)" : T.border}`,
      padding: "2px 8px", borderRadius: 99, letterSpacing: "0.04em", whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

function Aviso({ T, children, error }) {
  return (
    <p style={{
      margin: 0, padding: "9px 12px", borderRadius: 9, fontSize: 12, fontFamily: font,
      color: error ? "#FCA5A5" : T.txt2, lineHeight: 1.5,
      background: error ? "rgba(239,68,68,0.08)" : T.glass,
      border: `1px solid ${error ? "rgba(239,68,68,0.25)" : T.border}`,
    }}>{children}</p>
  );
}

function Separador({ T }) {
  return <div style={{ height: 1, background: T.border }} />;
}
