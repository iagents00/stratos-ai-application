// CuentasCobro.jsx — las cuentas de cobro de NSG a sus clientes.
//
// Pedido de Ángel (27-jul-2026):
//   «también deberíamos hacer algo para cuentas de cobro y que sea algo automático
//    y que se me envíe para poner la firma, como empresa NSG»
//   «la cuenta de cobro en pdf no debe quedar, debe quedar en word, para que yo
//    ponga la firma»
//   «será a partir de este 30 de este mes en adelante, con lo que vayamos haciendo
//    para Duke y el corporativo de las 5 empresas»
//
// Cómo funciona: el sistema arma el borrador solo, y el detalle lo saca del trabajo
// que DE VERDAD se cerró en el periodo (tareas cerradas + objetivos que se movieron).
// El monto lo pone la persona — el sistema no inventa cuánto se cobra.
// El botón "Descargar Word" genera el .docx en la misma máquina, así que el archivo
// no viaja por ningún lado y no se puede corromper en el camino.

import { useState, useEffect, useCallback } from "react";
import { FileText, Plus, RefreshCw, Download, Check, X, PenLine, UserRound, CalendarDays } from "lucide-react";
import { font, fontDisp } from "../../design-system/tokens";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { useIsMobile } from "../../hooks/useViewport";
import { descargarDocx } from "../../lib/docx";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
               "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const fechaLarga = (iso) => {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
};
const fechaCorta = (iso) => {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return `${d} ${MESES[m - 1].slice(0, 3)} ${y}`;
};
const money = (n, cur = "USD") =>
  `$${Number(n || 0).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;

// Monto en letras — una cuenta de cobro se firma, y en Colombia siempre lleva
// la cifra escrita además del número.
const UNI = ["", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez",
             "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve"];
const DEC = ["", "", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CEN = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos",
             "seiscientos", "setecientos", "ochocientos", "novecientos"];

function enLetras(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (n === 0) return "cero";
  if (n === 100) return "cien";
  if (n < 20) return UNI[n];
  if (n < 30) return n === 20 ? "veinte" : `veinti${UNI[n - 20]}`;
  if (n < 100) return DEC[Math.floor(n / 10)] + (n % 10 ? ` y ${UNI[n % 10]}` : "");
  if (n < 1000) return CEN[Math.floor(n / 100)] + (n % 100 ? ` ${enLetras(n % 100)}` : "");
  if (n < 1000000) {
    const miles = Math.floor(n / 1000);
    const cab = miles === 1 ? "mil" : `${enLetras(miles)} mil`;
    return cab + (n % 1000 ? ` ${enLetras(n % 1000)}` : "");
  }
  const mill = Math.floor(n / 1000000);
  const cab = mill === 1 ? "un millón" : `${enLetras(mill)} millones`;
  return cab + (n % 1000000 ? ` ${enLetras(n % 1000000)}` : "");
}

export default function CuentasCobro({ T, emisor }) {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const isLight = parseInt(String(T?.bg || "#000000").replace("#", "").slice(0, 2), 16) > 128;
  const txt    = T?.txt    || (isLight ? "#0B1220" : "#E2E8F0");
  const txt2   = T?.txt2   || (isLight ? "#3B4A61" : "#8B99AE");
  const txt3   = T?.txt3   || (isLight ? "#7A8699" : "#4A5568");
  const accent = T?.accent || (isLight ? "#0D9A76" : "#6EE7C2");
  const glass  = T?.glass  || (isLight ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.032)");
  const bd     = T?.border || (isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.07)");

  const card = {
    background: glass, border: `1px solid ${bd}`, borderRadius: 16,
    backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)",
  };
  const inputStyle = {
    background: isLight ? "#FFFFFF" : "rgba(255,255,255,0.045)", color: txt,
    border: `1px solid ${bd}`, borderRadius: 10, padding: "11px 13px",
    fontSize: 13.5, fontFamily: font, outline: "none", width: "100%", boxSizing: "border-box",
  };

  // `colorScheme` no es cosmético: sin él, en modo oscuro el navegador dibuja el
  // calendario nativo con fondo blanco y el iconito del día queda invisible.
  const campoFecha = {
    background: "transparent", border: "none", outline: "none", padding: 0,
    color: txt, fontSize: 13, fontFamily: font,
    colorScheme: isLight ? "light" : "dark", cursor: "pointer",
  };

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMonto, setEditMonto] = useState(null); // { id, valor }
  const [form, setForm] = useState({ cliente: "", monto: "", desde: "", hasta: "", concepto: "" });

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true); setError("");
    const { data, error: e } = await supabase.rpc("fn_fin_invoices_list", { p_profile_id: user.id });
    if (e) setError("No pude traer las cuentas de cobro. " + e.message);
    else setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const crear = async (ev) => {
    ev.preventDefault();
    if (!form.cliente.trim()) { setError("Decime a qué cliente se le cobra."); return; }
    // El monto se pide ACÁ: dejarlo para después es como terminaba una cuenta de
    // cobro en $0 sin que nadie lo notara hasta abrir el Word.
    if (!Number(String(form.monto).replace(",", "."))) { setError("Poné cuánto se le cobra."); return; }
    setSaving(true); setError("");
    const { data, error: e } = await supabase.rpc("fn_fin_cuenta_cobro_cliente", {
      p_profile_id: user.id,
      p_cliente: form.cliente.trim(),
      p_monto: form.monto === "" ? null : Number(form.monto),
      p_desde: form.desde || null,
      p_hasta: form.hasta || null,
      p_concepto: form.concepto.trim() || null,
    });
    setSaving(false);
    if (e) { setError(e.message); return; }
    if (typeof data === "string" && !data.startsWith("✓")) { setError(data); return; }
    setForm({ cliente: "", monto: "", desde: "", hasta: "", concepto: "" });
    setShowForm(false);
    load();
  };

  // Ángel: «puse quinientos y me sale cero». Antes esto era un UPDATE directo a la
  // tabla desde el navegador: si RLS o la sesión tropezaban, fallaba EN SILENCIO y
  // el Word salía con «cero dólares». Ahora va por una función que valida y, si
  // algo falla, lo dice. Con plata no se falla callado.
  const guardarMonto = async (id, valor) => {
    const monto = Number(String(valor).replace(",", "."));
    if (!monto || monto <= 0) { setError("Poné un monto mayor que cero."); return; }
    setError("");
    const { data, error: e } = await supabase.rpc("fn_fin_invoice_set_monto", {
      p_profile_id: user.id, p_invoice_id: id, p_monto: monto,
    });
    if (e || data?.ok === false) { setError(e?.message || data?.error || "No pude guardar el monto."); return; }
    setEditMonto(null);
    load();
  };

  // Cuenta de cobro MÍA a NSG (pedido de Ángel: «Duke le paga a NSG, pero Ángel
  // le cobra a NSG»). El monto no se pide: sale del saldo real que se le debe.
  const cobrarleALaEmpresa = async () => {
    setError("");
    const { data, error: e } = await supabase.rpc("fn_fin_cuenta_cobro_persona", {
      p_profile_id: user.id,
    });
    if (e) { setError(e.message); return; }
    if (typeof data === "string" && !data.startsWith("✓")) { setError(data); return; }
    load();
  };

  const marcar = async (id, campo) => {
    const patch = campo === "firmada"
      ? { firmada_at: new Date().toISOString(), estado: "firmada" }
      : { pagada_at: new Date().toISOString(), estado: "pagada" };
    const { error: e } = await supabase.from("fin_invoices").update(patch).eq("id", id);
    if (e) setError(e.message); else load();
  };

  // ── El Word ────────────────────────────────────────────────────────────────
  // Formato de cuenta de cobro estándar: quién cobra, a quién, cuánto (en número
  // y en letras), por qué concepto, el detalle de lo entregado, y el espacio de firma.
  const bajarWord = (inv) => {
    // Hay DOS direcciones y el documento tiene que decir bien quién le cobra a quién
    // (pedido de Ángel: «Duke le paga a NSG, pero Ángel le cobra a NSG»):
    //   tipo 'cliente' → NSG le cobra a Duke   → emite NSG, deben NSG
    //   tipo 'nomina'  → Ángel le cobra a NSG  → emite Ángel, debe la empresa
    const esMia = inv.tipo === "nomina";
    const nombreEmisor = esMia ? inv.beneficiario : (emisor?.nombre || "NSG");
    const aQuien = esMia ? (inv?.detalle?.cobra_a || emisor?.nombre || "NSG") : inv.beneficiario;
    const firmante = esMia ? inv.beneficiario : (emisor?.firmante || "");
    const idEmisor = esMia ? null : emisor?.identificacion;
    const items = Array.isArray(inv?.detalle?.items) ? inv.detalle.items : [];

    const bloques = [
      { text: nombreEmisor.toUpperCase(), bold: true, size: 12, align: "right", after: 0, color: "667085" },
      { text: `${emisor?.ciudad || "Bogotá"}, ${fechaLarga(new Date().toISOString().slice(0, 10))}`,
        size: 10, align: "right", after: 18, color: "667085" },

      { text: "CUENTA DE COBRO", bold: true, size: 20, align: "center", after: 3 },
      { text: `N° ${inv.numero}`, size: 10.5, align: "center", color: "667085", after: 16, linea: true },

      { text: [{ t: "Señores: ", bold: true }, { t: aQuien || "" }], before: 10, after: 2 },
      { text: [{ t: "Periodo: ", bold: true },
               { t: `${fechaLarga(inv.periodo_desde)} al ${fechaLarga(inv.periodo_hasta)}` }], after: 14 },

      { text: "DEBEN A", bold: true, size: 13, align: "center", before: 6, after: 2 },
      { text: nombreEmisor, bold: true, size: 15, align: "center", after: 2 },
      ...(idEmisor
        ? [{ text: idEmisor, size: 10.5, align: "center", color: "667085", after: 16 }]
        : [{ text: "", after: 12 }]),

      { text: "LA SUMA DE", bold: true, size: 11, after: 2 },
      { text: `${enLetras(inv.monto)} ${inv.moneda === "USD" ? "dólares" : inv.moneda} ` +
              `(${money(inv.monto, inv.moneda)})`,
        size: 12.5, bold: true, after: 16 },

      { text: "POR CONCEPTO DE", bold: true, size: 11, after: 2 },
      { text: inv.concepto || "Servicios prestados", after: 14 },
    ];

    if (items.length) {
      bloques.push({ text: "Entregado en el periodo", bold: true, size: 11, before: 4, after: 6, linea: true });
      items.forEach((it) => {
        bloques.push({
          text: [{ t: `${fechaCorta(it.fecha)}   `, color: "667085", size: 9.5 }, { t: it.que || "" }],
          size: 10.5, indent: 10, after: 4,
        });
      });
      bloques.push({ text: "", after: 16 });
    }

    bloques.push(
      { text: "Agradezco su pago a nombre de la empresa.", size: 10.5, color: "667085", before: 8, after: 46 },
      { text: "______________________________________", after: 3 },
      { text: firmante, bold: true, size: 11, after: 1 },
      ...(emisor?.identificacionFirmante
        ? [{ text: emisor.identificacionFirmante, size: 10, color: "667085", after: 1 }] : []),
      ...(esMia ? [] : [{ text: nombreEmisor, size: 10, color: "667085" }]),
    );

    descargarDocx(`Cuenta de cobro ${inv.numero} — ${inv.beneficiario || ""}`.trim(), bloques);
  };

  const estadoColor = (e) =>
    e === "pagada" ? (isLight ? "#0E9F6E" : "#34D399")
    : e === "firmada" ? accent
    : txt3;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 14.5, fontFamily: fontDisp, fontWeight: 500, color: txt }}>Cuentas de cobro</div>
          <div style={{ fontSize: 12, color: txt2, marginTop: 3 }}>
            El borrador se arma solo con lo que se entregó en el periodo · se descarga en Word para firmarla
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, width: isMobile ? "100%" : "auto", flexWrap: "wrap" }}>
          <button onClick={load} title="Actualizar" style={{ background: glass, border: `1px solid ${bd}`, borderRadius: 10, padding: "9px 11px", cursor: "pointer", color: txt2, display: "flex", alignItems: "center" }}>
            <RefreshCw size={15} style={loading ? { animation: "spin 1s linear infinite" } : undefined} />
          </button>
          <button onClick={cobrarleALaEmpresa} title="Armar mi cuenta de cobro por lo que se me debe"
            style={{
              background: "transparent", border: `1px solid ${bd}`, borderRadius: 12,
              padding: "12px 16px", cursor: "pointer", color: txt2,
              fontSize: 13, fontFamily: font, display: "flex", alignItems: "center",
              justifyContent: "center", gap: 7, flex: isMobile ? 1 : "none",
            }}>
            <UserRound size={15} /> Lo mío
          </button>
          <button onClick={() => setShowForm(s => !s)} style={{
            background: showForm ? "transparent" : `${accent}1A`, border: `1px solid ${accent}55`,
            borderRadius: 12, padding: "12px 16px", cursor: "pointer", color: accent,
            fontSize: 13, fontWeight: 600, fontFamily: font, display: "flex", alignItems: "center",
            justifyContent: "center", gap: 7, flex: isMobile ? 1 : "none",
          }}>
            {showForm ? <X size={15} /> : <Plus size={15} />} {showForm ? "Cerrar" : "A un cliente"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ ...card, padding: "12px 15px", fontSize: 12.5, color: isLight ? "#B42318" : "#F87171", borderColor: isLight ? "#FDA29B" : "#F8717155" }}>
          {error}
        </div>
      )}

      {/* Honestidad: el documento sale igual, pero sin NIT ni cédula una cuenta de
          cobro queda coja. No inventamos esos números — se avisa y listo. */}
      {(!emisor?.identificacion || !emisor?.identificacionFirmante) && (
        <div style={{ ...card, padding: "12px 15px", fontSize: 12.5, color: txt2, display: "flex", gap: 9, alignItems: "flex-start" }}>
          <PenLine size={15} color={accent} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Falta{" "}
            {!emisor?.identificacion && "el NIT de la empresa"}
            {!emisor?.identificacion && !emisor?.identificacionFirmante && " y "}
            {!emisor?.identificacionFirmante && `la cédula de ${emisor?.firmante || "quien firma"}`}.
            El Word se descarga igual, pero sin esos datos la cuenta de cobro queda incompleta —
            pasámelos una vez y quedan fijos para todas.
          </span>
        </div>
      )}

      {showForm && (
        <form onSubmit={crear} style={{ ...card, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 10 }}>
            <input placeholder="¿A qué cliente se le cobra? (ej: Duke)" value={form.cliente}
              onChange={e => setForm(f => ({ ...f, cliente: e.target.value }))} style={inputStyle} />
            <input type="number" step="0.01" placeholder="Cuánto se le cobra" value={form.monto}
              onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} style={inputStyle} />
          </div>
          {/* El periodo que se cobra. Antes eran dos cajas de fecha peladas, sin
              etiqueta: en pantalla se leían «dd/mm/aaaa  dd/mm/aaaa» y nadie sabía
              cuál era cuál. Ahora dicen qué son y se ven como un rango. */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
            border: `1px solid ${bd}`, borderRadius: 10, padding: "10px 13px",
            background: isLight ? "#FFFFFF" : "rgba(255,255,255,0.045)",
          }}>
            <CalendarDays size={15} color={accent} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: txt2, fontFamily: font }}>Periodo que se cobra</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
              <input type="date" value={form.desde} max={form.hasta || undefined} aria-label="Desde"
                onChange={e => setForm(f => ({ ...f, desde: e.target.value }))} style={campoFecha} />
              <span style={{ color: txt3, fontSize: 12, fontFamily: font }}>al</span>
              <input type="date" value={form.hasta} min={form.desde || undefined} aria-label="Hasta"
                onChange={e => setForm(f => ({ ...f, hasta: e.target.value }))} style={campoFecha} />
            </div>
          </div>
          <input placeholder="Concepto (vacío = servicios de desarrollo, automatización e IA)" value={form.concepto}
            onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))} style={inputStyle} />
          <div style={{ fontSize: 11.5, color: txt3 }}>
            Si dejás las fechas vacías toma la quincena que se está cerrando. El detalle de lo entregado
            lo saca solo de las tareas cerradas y los objetivos que se movieron en ese periodo.
          </div>
          <button type="submit" disabled={saving} style={{
            background: accent, border: "none", borderRadius: 10, padding: "12px 18px",
            cursor: saving ? "wait" : "pointer", color: isLight ? "#FFFFFF" : "#04140F",
            fontSize: 13.5, fontWeight: 600, fontFamily: font, alignSelf: "flex-start",
          }}>{saving ? "Armando…" : "Armar el borrador"}</button>
        </form>
      )}

      {!loading && !rows.length && (
        <div style={{ ...card, padding: "34px 20px", textAlign: "center" }}>
          <FileText size={26} color={txt3} strokeWidth={1.6} />
          <div style={{ fontSize: 13.5, color: txt2, marginTop: 10 }}>Todavía no hay ninguna cuenta de cobro.</div>
          <div style={{ fontSize: 12, color: txt3, marginTop: 4 }}>
            Armá la primera cuando cierre la quincena — el detalle sale solo del trabajo del periodo.
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((inv) => {
          const items = Array.isArray(inv?.detalle?.items) ? inv.detalle.items : [];
          const sinMonto = !Number(inv.monto);
          return (
            <div key={inv.id} style={{ ...card, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: txt, fontFamily: fontDisp }}>
                      {inv.tipo === "nomina"
                        ? `${inv.beneficiario} → ${inv?.detalle?.cobra_a || "NSG"}`
                        : `NSG → ${inv.beneficiario}`}
                    </span>
                    <span style={{ fontSize: 11, color: txt3 }}>{inv.numero}</span>
                    <span style={{
                      fontSize: 10.5, padding: "2px 8px", borderRadius: 999,
                      color: estadoColor(inv.estado), border: `1px solid ${estadoColor(inv.estado)}44`,
                      background: `${estadoColor(inv.estado)}14`, textTransform: "capitalize",
                    }}>{inv.estado}</span>
                  </div>
                  <div style={{ fontSize: 12, color: txt2, marginTop: 5 }}>
                    {fechaCorta(inv.periodo_desde)} — {fechaCorta(inv.periodo_hasta)}
                    {items.length ? ` · ${items.length} ${items.length === 1 ? "entrega" : "entregas"}` : ""}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {editMonto?.id === inv.id ? (
                    <>
                      <input type="number" step="0.01" autoFocus value={editMonto.valor}
                        onChange={e => setEditMonto({ id: inv.id, valor: e.target.value })}
                        onKeyDown={e => { if (e.key === "Enter") guardarMonto(inv.id, editMonto.valor); if (e.key === "Escape") setEditMonto(null); }}
                        style={{ ...inputStyle, width: 130, padding: "7px 10px" }} />
                      <button onClick={() => guardarMonto(inv.id, editMonto.valor)} style={{ background: `${accent}1A`, border: `1px solid ${accent}55`, borderRadius: 8, padding: "7px 9px", cursor: "pointer", color: accent, display: "flex" }}>
                        <Check size={14} />
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setEditMonto({ id: inv.id, valor: inv.monto || "" })}
                      title="Poner o cambiar el monto"
                      style={{
                        background: "transparent", border: `1px solid ${sinMonto ? `${accent}55` : "transparent"}`,
                        borderRadius: 8, padding: "5px 9px", cursor: "pointer",
                        color: sinMonto ? accent : txt, fontSize: sinMonto ? 12 : 16,
                        fontFamily: fontDisp, display: "flex", alignItems: "center", gap: 6,
                      }}>
                      {sinMonto ? <><PenLine size={13} /> Poner el monto</> : money(inv.monto, inv.moneda)}
                    </button>
                  )}

                  <button onClick={() => bajarWord(inv)} title="Descargar en Word para firmarla"
                    style={{
                      background: `${accent}1A`, border: `1px solid ${accent}55`, borderRadius: 9,
                      padding: "8px 13px", cursor: "pointer", color: accent, fontSize: 12.5,
                      fontFamily: font, fontWeight: 500, display: "flex", alignItems: "center", gap: 6,
                    }}>
                    <Download size={14} /> Word
                  </button>

                  {inv.estado === "borrador" && (
                    <button onClick={() => marcar(inv.id, "firmada")} title="Ya la firmé"
                      style={{ background: "transparent", border: `1px solid ${bd}`, borderRadius: 9, padding: "8px 12px", cursor: "pointer", color: txt2, fontSize: 12.5, fontFamily: font }}>
                      Ya la firmé
                    </button>
                  )}
                  {inv.estado === "firmada" && (
                    <button onClick={() => marcar(inv.id, "pagada")} title="Ya la pagaron"
                      style={{ background: "transparent", border: `1px solid ${bd}`, borderRadius: 9, padding: "8px 12px", cursor: "pointer", color: txt2, fontSize: 12.5, fontFamily: font }}>
                      Ya la pagaron
                    </button>
                  )}
                </div>
              </div>

              {!!items.length && (
                <div style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${bd}`, display: "flex", flexDirection: "column", gap: 5 }}>
                  {items.slice(0, 6).map((it, i) => (
                    <div key={i} style={{ fontSize: 12, color: txt2, display: "flex", gap: 9 }}>
                      <span style={{ color: txt3, flexShrink: 0, fontSize: 11 }}>{fechaCorta(it.fecha)}</span>
                      <span style={{ minWidth: 0 }}>{it.que}</span>
                    </div>
                  ))}
                  {items.length > 6 && (
                    <div style={{ fontSize: 11.5, color: txt3 }}>y {items.length - 6} más — todas salen en el Word</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
