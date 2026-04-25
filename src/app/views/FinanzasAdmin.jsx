import { useState } from "react";
import {
  Receipt, CreditCard, BookOpen, PiggyBank, ArrowDownLeft, DollarSign,
  ClipboardList, FilePlus, RefreshCw, BadgeCheck, ListChecks,
  Landmark, Scale, Calculator, Building2, Users, AlertCircle,
  TrendingUp, TrendingDown, CheckCircle2, FileText, Plus, X,
  ChevronDown, ChevronUp, BarChart3, Activity, Banknote, Percent,
  ArrowUpRight, Shield, Calendar
} from "lucide-react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { P, LP, font, fontDisp } from "../../design-system/tokens";
import { G, KPI, Pill, Ico } from "../SharedComponents";

const FinanzasAdmin = ({ T: _T }) => {
  const T = _T || P;
  const [tab, setTab] = useState("panel");
  const [cfdiFilter, setCfdiFilter] = useState("todos");
  const [showNewCFDI, setShowNewCFDI] = useState(false);
  const [cxTab, setCxTab] = useState("cobrar");
  const [cfdiForm, setCfdiForm] = useState({
    receptor: "", rfc: "", uso: "G03", tipo: "I", concepto: "",
    subtotal: "", iva: "16", metodoPago: "PUE", formaPago: "03", moneda: "MXN",
  });

  // ─── Datos: CFDI 4.0 ───
  const cfdiData = [
    { id: 1, uuid: "A1B2C3D4-E5F6-7890-ABCD-EF1234567890", fecha: "07/04/2026", tipo: "I", receptor: "Desarrolladora Riviera SA de CV", rfc: "DRI950301AB3", concepto: "Honorarios asesoría fiscal Q1-2026", subtotal: 45000, iva: 7200, total: 52200, status: "Vigente", metodo: "PUE", forma: "03", uso: "G03", serie: "A", folio: "001" },
    { id: 2, uuid: "B2C3D4E5-F6A7-8901-BCDE-F12345678901", fecha: "04/04/2026", tipo: "I", receptor: "Stratos Realty SC", rfc: "SRE200115P72", concepto: "Contabilidad mensual Abril 2026", subtotal: 8500, iva: 1360, total: 9860, status: "Vigente", metodo: "PPD", forma: "99", uso: "G03", serie: "A", folio: "002" },
    { id: 3, uuid: "C3D4E5F6-A7B8-9012-CDEF-123456789012", fecha: "01/04/2026", tipo: "I", receptor: "Inversiones Costa SA de CV", rfc: "ICO180420HJ5", concepto: "Declaración anual ISR personas morales 2025", subtotal: 22000, iva: 3520, total: 25520, status: "Vigente", metodo: "PUE", forma: "03", uso: "G03", serie: "A", folio: "003" },
    { id: 4, uuid: "D4E5F6A7-B8C9-0123-DEF0-234567890123", fecha: "28/03/2026", tipo: "E", receptor: "Adobe Systems Inc.", rfc: "XEXX010101000", concepto: "Nota de crédito — ajuste honorarios Q4-2025", subtotal: 3500, iva: 560, total: 4060, status: "Vigente", metodo: "PUE", forma: "03", uso: "G01", serie: "NC", folio: "001" },
    { id: 5, uuid: "E5F6A7B8-C9D0-1234-EF01-345678901234", fecha: "25/03/2026", tipo: "I", receptor: "Grupo Inmobiliario del Caribe SA", rfc: "GIC150630KM9", concepto: "Auditoría fiscal preventiva 2025", subtotal: 35000, iva: 5600, total: 40600, status: "Cancelado", metodo: "PUE", forma: "04", uso: "G03", serie: "A", folio: "004" },
    { id: 6, uuid: "F6A7B8C9-D0E1-2345-F012-456789012345", fecha: "20/03/2026", tipo: "P", receptor: "Stratos Realty SC", rfc: "SRE200115P72", concepto: "Complemento de pago — Factura A-002", subtotal: 0, iva: 0, total: 9860, status: "Vigente", metodo: "PPD", forma: "03", uso: "CP01", serie: "P", folio: "001" },
    { id: 7, uuid: "A7B8C9D0-E1F2-3456-0123-567890123456", fecha: "15/03/2026", tipo: "I", receptor: "Promotora Tulum Norte SA de CV", rfc: "PTN190805RF2", concepto: "Asesoría fiscal — reestructuración corporativa", subtotal: 60000, iva: 9600, total: 69600, status: "Vigente", metodo: "PUE", forma: "02", uso: "G03", serie: "A", folio: "005" },
    { id: 8, uuid: "B8C9D0E1-F2A3-4567-1234-678901234567", fecha: "10/03/2026", tipo: "I", receptor: "Publico en General", rfc: "XAXX010101000", concepto: "Servicios contables — cliente general", subtotal: 1200, iva: 192, total: 1392, status: "Vigente", metodo: "PUE", forma: "01", uso: "S01", serie: "A", folio: "006" },
  ];

  // ─── Datos: Calendario Fiscal 2026 ───
  const obligaciones = [
    { id: 1, fecha: "17/04/2026", tipo: "ISR", desc: "Pago provisional ISR personas morales — Marzo 2026", periodicidad: "Mensual", status: "Pendiente", urgente: true, articulo: "Art. 14 LISR" },
    { id: 2, fecha: "17/04/2026", tipo: "IVA", desc: "Declaración mensual IVA — Marzo 2026", periodicidad: "Mensual", status: "Pendiente", urgente: true, articulo: "Art. 5-D LIVA" },
    { id: 3, fecha: "17/04/2026", tipo: "IMSS", desc: "Liquidación cuotas IMSS — Marzo 2026 (SUA)", periodicidad: "Mensual", status: "Pendiente", urgente: true, articulo: "Art. 39 LSS" },
    { id: 4, fecha: "17/04/2026", tipo: "CFDI", desc: "Emisión CFDI nómina mensual — Abril 2026 (timbrar)", periodicidad: "Mensual", status: "Completada", urgente: false, articulo: "Art. 99 LISR" },
    { id: 5, fecha: "30/04/2026", tipo: "ISR", desc: "Declaración anual ISR personas físicas — Ejercicio 2025", periodicidad: "Anual", status: "En proceso", urgente: true, articulo: "Art. 150 LISR" },
    { id: 6, fecha: "17/05/2026", tipo: "ISR", desc: "Pago provisional ISR personas morales — Abril 2026", periodicidad: "Mensual", status: "Próxima", urgente: false, articulo: "Art. 14 LISR" },
    { id: 7, fecha: "17/05/2026", tipo: "IVA", desc: "Declaración mensual IVA — Abril 2026", periodicidad: "Mensual", status: "Próxima", urgente: false, articulo: "Art. 5-D LIVA" },
    { id: 8, fecha: "30/05/2026", tipo: "DIOT", desc: "DIOT — Declaración Informativa Operaciones con Terceros Abril", periodicidad: "Mensual", status: "Próxima", urgente: false, articulo: "Art. 32 LIVA" },
    { id: 9, fecha: "17/05/2026", tipo: "CONT", desc: "Envío contabilidad electrónica SAT — Abril 2026 (XML)", periodicidad: "Mensual", status: "Próxima", urgente: false, articulo: "Art. 28 CFF" },
    { id: 10, fecha: "03/04/2026", tipo: "ISR", desc: "Pago provisional ISR personas morales — Febrero 2026", periodicidad: "Mensual", status: "Completada", urgente: false, articulo: "Art. 14 LISR" },
    { id: 11, fecha: "03/04/2026", tipo: "IVA", desc: "Declaración mensual IVA — Febrero 2026", periodicidad: "Mensual", status: "Completada", urgente: false, articulo: "Art. 5-D LIVA" },
    { id: 12, fecha: "31/03/2026", tipo: "ISR", desc: "Declaración anual ISR personas morales — Ejercicio 2025", periodicidad: "Anual", status: "Completada", urgente: false, articulo: "Art. 76 LISR" },
  ];

  // ─── Datos: Cuentas por Cobrar ───
  const cxcData = [
    { id: 1, cliente: "Desarrolladora Riviera SA de CV", rfc: "DRI950301AB3", factura: "A-001", monto: 52200, vencimiento: "21/04/2026", diasVenc: -14, status: "Vigente" },
    { id: 2, cliente: "Grupo Inmobiliario del Caribe SA", rfc: "GIC150630KM9", factura: "A-005", monto: 69600, vencimiento: "04/04/2026", diasVenc: 3, status: "Vencida" },
    { id: 3, cliente: "Promotora Tulum Norte SA de CV", rfc: "PTN190805RF2", factura: "A-007", monto: 69600, vencimiento: "14/04/2026", diasVenc: -7, status: "Vigente" },
    { id: 4, cliente: "Inversiones Costa SA de CV", rfc: "ICO180420HJ5", factura: "A-003", monto: 25520, vencimiento: "01/05/2026", diasVenc: -24, status: "Vigente" },
    { id: 5, cliente: "Stratos Realty SC", rfc: "SRE200115P72", factura: "A-002", monto: 9860, vencimiento: "20/03/2026", diasVenc: 18, status: "Pagada" },
    { id: 6, cliente: "Constructora Akumal SRL", rfc: "CAK200710LP3", factura: "A-008", monto: 15400, vencimiento: "10/03/2026", diasVenc: 28, status: "Vencida" },
  ];

  // ─── Datos: Cuentas por Pagar ───
  const cxpData = [
    { id: 1, proveedor: "Colegio de Contadores Públicos", rfc: "CCP550101LP8", concepto: "Cuota anual membresía 2026", monto: 4800, vencimiento: "30/04/2026", status: "Pendiente" },
    { id: 2, proveedor: "Facturaelectronicaplus SA de CV", rfc: "FEP180910KJ2", concepto: "Licencia software facturación CFDI 4.0 (anual)", monto: 12500, vencimiento: "15/04/2026", status: "Pendiente" },
    { id: 3, proveedor: "Arrendadora Polanco SA de CV", rfc: "APO150220RF5", concepto: "Renta oficina Abril 2026", monto: 22000, vencimiento: "05/04/2026", status: "Pagada" },
    { id: 4, proveedor: "CFE (Comisión Federal Electricidad)", rfc: "CFE370814QI0", concepto: "Servicio eléctrico bimestral", monto: 1850, vencimiento: "20/04/2026", status: "Pendiente" },
    { id: 5, proveedor: "SAT — Resolución Miscelánea", rfc: "SAT970701NN3", concepto: "Contribuciones fiscales — ISR provisional Febrero", monto: 18400, vencimiento: "17/03/2026", status: "Pagada" },
  ];

  // ─── Datos: Flujo de Caja ───
  const flujoData = [
    { mes: "Ene", ingresos: 95400, egresos: 62000, saldo: 33400 },
    { mes: "Feb", ingresos: 112800, egresos: 71500, saldo: 41300 },
    { mes: "Mar", ingresos: 148600, egresos: 89200, saldo: 59400 },
    { mes: "Abr", ingresos: 158000, egresos: 95800, saldo: 62200 },
    { mes: "May", ingresos: 134500, egresos: 84300, saldo: 50200 },
    { mes: "Jun", ingresos: 162000, egresos: 98000, saldo: 64000 },
    { mes: "Jul", ingresos: 178000, egresos: 101000, saldo: 77000 },
    { mes: "Ago", ingresos: 155000, egresos: 96000, saldo: 59000 },
    { mes: "Sep", ingresos: 171000, egresos: 104000, saldo: 67000 },
    { mes: "Oct", ingresos: 188000, egresos: 112000, saldo: 76000 },
    { mes: "Nov", ingresos: 195000, egresos: 118000, saldo: 77000 },
    { mes: "Dic", ingresos: 210000, egresos: 132000, saldo: 78000 },
  ];

  // ─── Helpers ───
  const fmt = (n) => n >= 1000000 ? `$${(n / 1000000).toFixed(2)}M` : `$${n.toLocaleString("es-MX")}`;
  const fmtPct = (n) => `${n.toFixed(1)}%`;
  const tipoColor = { I: T.emerald, E: T.rose, P: T.blue, T: T.violet };
  const tipoLabel = { I: "Ingreso", E: "Egreso", P: "Pago", T: "Traslado" };
  const tipoObl = { ISR: T.blue, IVA: T.emerald, IMSS: T.violet, CFDI: T.accent, DIOT: T.amber, CONT: T.cyan };
  const statusCFDI = { Vigente: T.emerald, Cancelado: T.rose, "Por cobrar": T.amber };
  const statusObl = { Completada: T.emerald, Pendiente: T.amber, "En proceso": T.blue, Próxima: T.txt3, Vencida: T.rose };
  const statusCX = { Vigente: T.accent, Vencida: T.rose, Pagada: T.emerald, Pendiente: T.amber };

  const totalIngresos = cfdiData.filter(c => c.tipo === "I" && c.status === "Vigente").reduce((s, c) => s + c.total, 0);
  const totalIVA = cfdiData.filter(c => c.tipo === "I" && c.status === "Vigente").reduce((s, c) => s + c.iva, 0);
  const totalCXC = cxcData.filter(c => c.status !== "Pagada").reduce((s, c) => s + c.monto, 0);
  const cxcVencidas = cxcData.filter(c => c.status === "Vencida").reduce((s, c) => s + c.monto, 0);
  const totalCXP = cxpData.filter(c => c.status === "Pendiente").reduce((s, c) => s + c.monto, 0);
  const isrProvisional = Math.round(totalIngresos * 0.30 * 0.17); // 30% base × 17% coeficiente simplificado

  const cfdiFiltered = cfdiFilter === "todos" ? cfdiData : cfdiFilter === "cancelado" ? cfdiData.filter(c => c.status === "Cancelado") : cfdiData.filter(c => c.tipo === cfdiFilter);

  const tabs = [
    { id: "panel", label: "Panel General", icon: BarChart3 },
    { id: "cfdi", label: "Facturación CFDI 4.0", icon: Receipt },
    { id: "fiscal", label: "Obligaciones Fiscales", icon: ListChecks },
    { id: "cuentas", label: "Cuentas CxC / CxP", icon: Wallet },
    { id: "flujo", label: "Flujo de Caja", icon: TrendingUp },
  ];

  // ─── Render Modal: Nueva Factura ───
  const NewCFDIModal = () => {
    const usoCFDI = [
      { c: "G01", l: "Adquisición de mercancias" }, { c: "G03", l: "Gastos en general" },
      { c: "I01", l: "Construcciones" }, { c: "I03", l: "Equipo de transporte" },
      { c: "I06", l: "Comunicaciones telefónicas" }, { c: "D01", l: "Honorarios médicos, dentales y hospitalarios" },
      { c: "S01", l: "Sin efectos fiscales" }, { c: "CP01", l: "Pagos" },
    ];
    const formasPago = [
      { c: "01", l: "Efectivo" }, { c: "02", l: "Cheque nominativo" },
      { c: "03", l: "Transferencia electrónica de fondos" }, { c: "04", l: "Tarjeta de crédito" },
      { c: "28", l: "Tarjeta de débito" }, { c: "99", l: "Por definir" },
    ];
    const subtotalNum = parseFloat(cfdiForm.subtotal) || 0;
    const ivaNum = subtotalNum * (parseFloat(cfdiForm.iva) / 100);
    const totalNum = subtotalNum + ivaNum;
    const set = (k, v) => setCfdiForm(p => ({ ...p, [k]: v }));

    return createPortal(
      <>
        <div onClick={() => setShowNewCFDI(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)", zIndex: 300000 }} />
        <div style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 300001,
          width: 680, maxHeight: "92vh", overflowY: "auto",
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: 22,
          boxShadow: "0 40px 100px rgba(0,0,0,0.7)",
        }}>
          {/* Header */}
          <div style={{ padding: "22px 28px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(110,231,194,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Ico icon={FilePlus} sz={38} is={18} c={T.accent} />
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#FFF", fontFamily: fontDisp }}>Nueva Factura — CFDI 4.0</p>
                <p style={{ fontSize: 11, color: T.txt3, marginTop: 2 }}>Conforme a la Resolución Miscelánea Fiscal 2026 · SAT</p>
              </div>
            </div>
            <button onClick={() => setShowNewCFDI(false)} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.border}`, background: T.glass, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} color={T.txt2} /></button>
          </div>
          <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Tipo CFDI */}
            <div>
              <label style={{ fontSize: 10, color: T.txt2, display: "block", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Tipo de Comprobante</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[{ v: "I", l: "Ingreso", c: T.emerald }, { v: "E", l: "Egreso", c: T.rose }, { v: "P", l: "Pago", c: T.blue }, { v: "T", l: "Traslado", c: T.violet }].map(t => (
                  <button key={t.v} onClick={() => set("tipo", t.v)} style={{ flex: 1, padding: "10px 8px", borderRadius: 10, border: `1px solid ${cfdiForm.tipo === t.v ? t.c + "60" : T.border}`, background: cfdiForm.tipo === t.v ? `${t.c}12` : T.glass, color: cfdiForm.tipo === t.v ? t.c : T.txt2, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp }}>
                    {t.l}
                  </button>
                ))}
              </div>
            </div>
            {/* Receptor */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ fontSize: 10, color: T.txt2, display: "block", marginBottom: 5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Receptor / Razón social</label>
                <input value={cfdiForm.receptor} onChange={e => set("receptor", e.target.value)} placeholder="Nombre o razón social..." style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: T.glass, border: `1px solid ${T.border}`, color: T.txt, fontSize: 13, fontFamily: font, outline: "none" }} onFocus={e => e.target.style.borderColor = T.accent + "50"} onBlur={e => e.target.style.borderColor = T.border} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: T.txt2, display: "block", marginBottom: 5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>RFC del Receptor</label>
                <input value={cfdiForm.rfc} onChange={e => set("rfc", e.target.value.toUpperCase())} placeholder="XAXX010101000" maxLength={13} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: T.glass, border: `1px solid ${T.border}`, color: T.accent, fontSize: 13, fontFamily: "monospace", outline: "none", letterSpacing: "0.06em" }} onFocus={e => e.target.style.borderColor = T.accent + "50"} onBlur={e => e.target.style.borderColor = T.border} />
              </div>
            </div>
            {/* Concepto */}
            <div>
              <label style={{ fontSize: 10, color: T.txt2, display: "block", marginBottom: 5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Descripción / Concepto</label>
              <textarea value={cfdiForm.concepto} onChange={e => set("concepto", e.target.value)} rows={2} placeholder="Descripción detallada del servicio o producto..." style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: T.glass, border: `1px solid ${T.border}`, color: T.txt, fontSize: 13, fontFamily: font, outline: "none", resize: "vertical" }} />
            </div>
            {/* Importes */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 0.5fr 1fr", gap: 14 }}>
              <div>
                <label style={{ fontSize: 10, color: T.txt2, display: "block", marginBottom: 5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Subtotal (MXN)</label>
                <input type="number" value={cfdiForm.subtotal} onChange={e => set("subtotal", e.target.value)} placeholder="0.00" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: T.glass, border: `1px solid ${T.border}`, color: T.txt, fontSize: 14, fontFamily: fontDisp, outline: "none", fontWeight: 600 }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: T.txt2, display: "block", marginBottom: 5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>IVA %</label>
                <select value={cfdiForm.iva} onChange={e => set("iva", e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: T.surface, border: `1px solid ${T.border}`, color: T.txt, fontSize: 13, fontFamily: font }}>
                  <option value="16">16%</option>
                  <option value="8">8% (Zona fronteriza)</option>
                  <option value="0">0% (Tasa cero)</option>
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                <div style={{ padding: "10px 14px", borderRadius: 8, background: `${T.accent}08`, border: `1px solid ${T.accent}20`, textAlign: "right" }}>
                  <p style={{ fontSize: 10, color: T.txt3, marginBottom: 3 }}>TOTAL CFDI</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: T.accent, fontFamily: fontDisp }}>${totalNum.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>
            {/* Fiscal fields */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ fontSize: 10, color: T.txt2, display: "block", marginBottom: 5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Método de pago</label>
                <select value={cfdiForm.metodoPago} onChange={e => set("metodoPago", e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: T.surface, border: `1px solid ${T.border}`, color: T.txt, fontSize: 13, fontFamily: font }}>
                  <option value="PUE">PUE — Pago en una sola exhibición</option>
                  <option value="PPD">PPD — Pago en parcialidades o diferido</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, color: T.txt2, display: "block", marginBottom: 5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Forma de pago</label>
                <select value={cfdiForm.formaPago} onChange={e => set("formaPago", e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: T.surface, border: `1px solid ${T.border}`, color: T.txt, fontSize: 13, fontFamily: font }}>
                  {[{ c: "01", l: "Efectivo" }, { c: "02", l: "Cheque" }, { c: "03", l: "Transferencia" }, { c: "04", l: "T. Crédito" }, { c: "28", l: "T. Débito" }, { c: "99", l: "Por definir" }].map(f => (
                    <option key={f.c} value={f.c}>{f.c} — {f.l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, color: T.txt2, display: "block", marginBottom: 5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Uso CFDI</label>
                <select value={cfdiForm.uso} onChange={e => set("uso", e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: T.surface, border: `1px solid ${T.border}`, color: T.txt, fontSize: 13, fontFamily: font }}>
                  {usoCFDI.map(u => <option key={u.c} value={u.c}>{u.c} — {u.l}</option>)}
                </select>
              </div>
            </div>
            {/* SAT notice */}
            <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(110,231,194,0.05)", border: `1px solid ${T.accent}20`, display: "flex", gap: 10 }}>
              <BadgeCheck size={16} color={T.accent} style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 11, color: T.txt2, lineHeight: 1.6, fontFamily: font }}>
                Este CFDI se generará conforme al <strong style={{ color: T.accent }}>Estándar CFDI 4.0</strong> (Anexo 20, RMF 2026). El timbrado se realizará vía PAC autorizado por el SAT. El archivo XML quedará disponible para descarga inmediata. Vigencia: hasta cancelación o 5 años.
              </p>
            </div>
            {/* Actions */}
            <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
              <button onClick={() => setShowNewCFDI(false)} style={{ flex: 1, padding: "12px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.glass, color: T.txt2, fontSize: 13, cursor: "pointer", fontFamily: font }}>Cancelar</button>
              <button
                disabled={!cfdiForm.receptor || !cfdiForm.rfc || !cfdiForm.subtotal}
                onClick={() => setShowNewCFDI(false)}
                style={{ flex: 2, padding: "13px", borderRadius: 10, border: "none", background: cfdiForm.receptor && cfdiForm.rfc && cfdiForm.subtotal ? "rgba(255,255,255,0.95)" : T.glass, color: cfdiForm.receptor && cfdiForm.rfc && cfdiForm.subtotal ? "#0A0F18" : T.txt3, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp }}
              >
                <FilePlus size={14} style={{ marginRight: 8, verticalAlign: "middle" }} />
                Timbrar CFDI 4.0 — Total: ${totalNum.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
              </button>
            </div>
          </div>
        </div>
      </>,
      document.body
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: font }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <Ico icon={Landmark} sz={42} is={20} c={T.accent} />
            <div>
              <p style={{ fontSize: 22, fontWeight: 300, color: "#FFF", fontFamily: fontDisp, letterSpacing: "-0.03em" }}>
                Finanzas <span style={{ fontWeight: 600, color: T.accent }}>&amp;</span> Administración
              </p>
              <p style={{ fontSize: 11, color: T.txt3, marginTop: 2, letterSpacing: "0.01em" }}>
                Sistema Contable-Fiscal · México 2026 · CFDI 4.0 · RMF 2026 · NIF · SAT
              </p>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.glass, cursor: "pointer", color: T.txt2, fontSize: 12, fontWeight: 600, fontFamily: fontDisp }}>
            <Download size={13} /> Exportar
          </button>
          <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.glass, cursor: "pointer", color: T.txt2, fontSize: 12, fontWeight: 600, fontFamily: fontDisp }}>
            <RefreshCw size={13} /> Sincronizar SAT
          </button>
          <button onClick={() => setShowNewCFDI(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 20px", borderRadius: 9, border: "none", background: "rgba(255,255,255,0.95)", cursor: "pointer", color: "#0A0F18", fontSize: 12, fontWeight: 700, fontFamily: fontDisp, boxShadow: "0 4px 18px rgba(255,255,255,0.12)" }}>
            <FilePlus size={14} /> Nueva Factura CFDI
          </button>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div style={{ display: "flex", gap: 4, padding: "4px", borderRadius: 12, background: "rgba(255,255,255,0.025)", border: `1px solid ${T.border}` }}>
        {tabs.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              padding: "10px 12px", borderRadius: 9, border: "none", cursor: "pointer",
              background: active ? "rgba(255,255,255,0.08)" : "transparent",
              color: active ? T.txt : T.txt3, fontSize: 12, fontWeight: active ? 700 : 400,
              fontFamily: fontDisp, transition: "all 0.2s",
              boxShadow: active ? "0 1px 8px rgba(0,0,0,0.3)" : "none",
            }}>
              <t.icon size={13} color={active ? T.accent : T.txt3} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════
          TAB 1: PANEL GENERAL
          ═══════════════════════════════ */}
      {tab === "panel" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
            {[
              { l: "Ingresos del Periodo", v: fmt(totalIngresos), sub: "CFDIs vigentes", c: T.emerald, i: TrendingUp },
              { l: "IVA Acreditable", v: fmt(totalIVA), sub: "Por declarar", c: T.accent, i: Percent },
              { l: "ISR Provisional", v: fmt(isrProvisional), sub: "Estimado periodo", c: T.blue, i: Banknote },
              { l: "Cuentas por Cobrar", v: fmt(totalCXC), sub: "Activas", c: T.violet, i: Wallet },
              { l: "CxC Vencidas", v: fmt(cxcVencidas), sub: "Requieren acción", c: T.rose, i: AlertCircle },
              { l: "Cuentas por Pagar", v: fmt(totalCXP), sub: "Pendientes", c: T.amber, i: CreditCard },
            ].map(k => (
              <G key={k.l} hover style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <p style={{ fontSize: 10, color: T.txt2, fontWeight: 600, letterSpacing: "0.03em", lineHeight: 1.4 }}>{k.l}</p>
                  <Ico icon={k.i} sz={28} is={13} c={k.c} />
                </div>
                <p style={{ fontSize: 22, fontWeight: 300, color: "#FFF", fontFamily: fontDisp, letterSpacing: "-0.04em", lineHeight: 1 }}>{k.v}</p>
                <p style={{ fontSize: 10, color: k.c, fontWeight: 600 }}>{k.sub}</p>
              </G>
            ))}
          </div>

          {/* Gráfica + últimas facturas */}
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>
            <G>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>Flujo de Ingresos vs Egresos</p>
                  <p style={{ fontSize: 11, color: T.txt3, marginTop: 2 }}>Ejercicio fiscal 2026</p>
                </div>
                <Pill color={T.emerald} s>+18% vs 2025</Pill>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={flujoData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="ingG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.emerald} stopOpacity={0.25} /><stop offset="95%" stopColor={T.emerald} stopOpacity={0} /></linearGradient>
                    <linearGradient id="egG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.rose} stopOpacity={0.2} /><stop offset="95%" stopColor={T.rose} stopOpacity={0} /></linearGradient>
                  </defs>
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: T.txt3 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: T.txt3 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v / 1000}K`} />
                  <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11 }} formatter={v => [`$${v.toLocaleString("es-MX")}`, ""]} />
                  <Area type="monotone" dataKey="ingresos" stroke={T.emerald} strokeWidth={2} fill="url(#ingG)" name="Ingresos" />
                  <Area type="monotone" dataKey="egresos" stroke={T.rose} strokeWidth={2} fill="url(#egG)" name="Egresos" />
                </AreaChart>
              </ResponsiveContainer>
            </G>
            <G np>
              <div style={{ padding: "16px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>Últimas Facturas</p>
                <button onClick={() => setTab("cfdi")} style={{ fontSize: 11, color: T.accent, background: "none", border: "none", cursor: "pointer" }}>Ver todo →</button>
              </div>
              {cfdiData.slice(0, 5).map(c => (
                <div key={c.id} style={{ padding: "12px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: tipoColor[c.tipo], background: `${tipoColor[c.tipo]}15`, padding: "2px 7px", borderRadius: 4 }}>{tipoLabel[c.tipo]}</span>
                      <span style={{ fontSize: 10, color: T.txt3 }}>{c.fecha}</span>
                    </div>
                    <p style={{ fontSize: 12, color: T.txt, fontWeight: 600, fontFamily: fontDisp, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 }}>{c.receptor}</p>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: c.tipo === "E" ? T.rose : T.emerald, fontFamily: fontDisp, flexShrink: 0 }}>{c.tipo === "E" ? "-" : "+"}{fmt(c.total)}</p>
                </div>
              ))}
            </G>
          </div>

          {/* Próximas Obligaciones */}
          <G>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Ico icon={AlertTriangle} sz={32} is={14} c={T.amber} />
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>Obligaciones Fiscales Próximas</p>
                  <p style={{ fontSize: 11, color: T.txt3 }}>Declaraciones y pagos al SAT pendientes · RMF 2026</p>
                </div>
              </div>
              <button onClick={() => setTab("fiscal")} style={{ fontSize: 11, color: T.accent, background: "none", border: "none", cursor: "pointer" }}>Ver calendario completo →</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {obligaciones.filter(o => o.status !== "Completada").slice(0, 3).map(o => (
                <div key={o.id} style={{ padding: "14px 16px", borderRadius: 12, border: `1px solid ${o.urgente ? T.amber + "40" : T.border}`, background: o.urgente ? `${T.amber}06` : T.glass }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: tipoObl[o.tipo], background: `${tipoObl[o.tipo]}15`, padding: "3px 8px", borderRadius: 5 }}>{o.tipo}</span>
                    <span style={{ fontSize: 10, color: o.urgente ? T.amber : T.txt3, fontWeight: 600 }}>{o.fecha}</span>
                  </div>
                  <p style={{ fontSize: 11, color: T.txt, lineHeight: 1.5, marginBottom: 6 }}>{o.desc}</p>
                  <p style={{ fontSize: 9, color: T.txt3, fontStyle: "italic" }}>{o.articulo}</p>
                </div>
              ))}
            </div>
          </G>
        </div>
      )}

      {/* ═══════════════════════════════
          TAB 2: FACTURACIÓN CFDI 4.0
          ═══════════════════════════════ */}
      {tab === "cfdi" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Filter + search bar */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {[
              { v: "todos", l: "Todos" },
              { v: "I", l: "Ingresos" },
              { v: "E", l: "Egresos" },
              { v: "P", l: "Pagos" },
              { v: "T", l: "Traslados" },
              { v: "cancelado", l: "Cancelados" },
            ].map(f => (
              <button key={f.v} onClick={() => setCfdiFilter(f.v)} style={{
                padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: fontDisp,
                border: `1px solid ${cfdiFilter === f.v ? T.accent + "50" : T.border}`,
                background: cfdiFilter === f.v ? T.accentS : T.glass,
                color: cfdiFilter === f.v ? T.accent : T.txt2, cursor: "pointer", transition: "all 0.2s",
              }}>{f.l}</button>
            ))}
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", borderRadius: 8, background: T.glass, border: `1px solid ${T.border}` }}>
              <Search size={13} color={T.txt3} />
              <input placeholder="Buscar RFC, receptor, UUID..." style={{ background: "transparent", border: "none", outline: "none", color: T.txt, fontSize: 12, flex: 1, fontFamily: font }} />
            </div>
            <button onClick={() => setShowNewCFDI(true)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 18px", borderRadius: 8, border: "none", background: "rgba(255,255,255,0.95)", cursor: "pointer", color: "#0A0F18", fontSize: 12, fontWeight: 700, fontFamily: fontDisp }}>
              <FilePlus size={13} /> Nueva Factura
            </button>
            <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.glass, cursor: "pointer", color: T.txt2, fontSize: 12, fontFamily: fontDisp }}>
              <Download size={13} /> XML/PDF
            </button>
          </div>

          {/* CFDI Table */}
          <G np>
            <div style={{ display: "grid", gridTemplateColumns: "0.6fr 0.7fr 1.6fr 0.8fr 0.7fr 0.7fr 0.7fr 0.5fr", gap: 8, padding: "10px 20px", borderBottom: `1px solid ${T.border}`, fontSize: 9, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
              <span>Tipo</span><span>Fecha</span><span>Receptor / RFC</span><span>Concepto</span><span>Subtotal</span><span>IVA</span><span>Total</span><span>Status</span>
            </div>
            {cfdiFiltered.map(c => (
              <div key={c.id} style={{ display: "grid", gridTemplateColumns: "0.6fr 0.7fr 1.6fr 0.8fr 0.7fr 0.7fr 0.7fr 0.5fr", gap: 8, alignItems: "center", padding: "13px 20px", borderBottom: `1px solid ${T.border}`, transition: "background 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: tipoColor[c.tipo], background: `${tipoColor[c.tipo]}15`, padding: "3px 8px", borderRadius: 5, textAlign: "center" }}>{tipoLabel[c.tipo]}</span>
                <span style={{ fontSize: 11, color: T.txt2 }}>{c.fecha}</span>
                <div>
                  <p style={{ fontSize: 12, color: T.txt, fontWeight: 600, fontFamily: fontDisp }}>{c.receptor}</p>
                  <p style={{ fontSize: 9, color: T.txt3, fontFamily: "monospace", marginTop: 2 }}>{c.rfc}</p>
                </div>
                <p style={{ fontSize: 11, color: T.txt2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.concepto.substring(0, 30)}…</p>
                <span style={{ fontSize: 12, color: T.txt, fontFamily: fontDisp, fontWeight: 600 }}>{fmt(c.subtotal)}</span>
                <span style={{ fontSize: 11, color: T.amber, fontFamily: fontDisp }}>{fmt(c.iva)}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: c.tipo === "E" ? T.rose : T.emerald, fontFamily: fontDisp }}>{fmt(c.total)}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: statusCFDI[c.status] || T.txt3, background: `${statusCFDI[c.status] || T.txt3}15`, padding: "3px 8px", borderRadius: 5, textAlign: "center" }}>{c.status}</span>
              </div>
            ))}
          </G>

          {/* UUID info bar */}
          <G style={{ padding: "12px 18px", background: "rgba(110,231,194,0.03)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <BadgeCheck size={15} color={T.accent} />
              <p style={{ fontSize: 11, color: T.txt2, fontFamily: font }}>
                <strong style={{ color: T.accent }}>CFDI 4.0</strong> · Complemento de Pago · Carta Porte · Nómina 1.2 · Resolución Miscelánea Fiscal 2026 ·
                Los UUID se validan en tiempo real con el servicio de verificación del SAT.
              </p>
            </div>
          </G>
        </div>
      )}

      {/* ═══════════════════════════════
          TAB 3: OBLIGACIONES FISCALES
          ═══════════════════════════════ */}
      {tab === "fiscal" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Summary pills */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { l: "Completadas", v: obligaciones.filter(o => o.status === "Completada").length, c: T.emerald, i: CheckSquare },
              { l: "Pendientes", v: obligaciones.filter(o => o.status === "Pendiente").length, c: T.amber, i: Clock },
              { l: "En Proceso", v: obligaciones.filter(o => o.status === "En proceso").length, c: T.blue, i: RefreshCw },
              { l: "Próximas", v: obligaciones.filter(o => o.status === "Próxima").length, c: T.txt3, i: CalendarDays },
            ].map(k => (
              <G key={k.l} hover style={{ display: "flex", alignItems: "center", gap: 14, padding: 16 }}>
                <Ico icon={k.i} sz={38} is={17} c={k.c} />
                <div>
                  <p style={{ fontSize: 26, fontWeight: 300, color: "#FFF", fontFamily: fontDisp, letterSpacing: "-0.04em" }}>{k.v}</p>
                  <p style={{ fontSize: 11, color: T.txt2 }}>{k.l}</p>
                </div>
              </G>
            ))}
          </div>

          {/* Obligations list */}
          <G np>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>Calendario de Obligaciones Fiscales 2026</p>
                <p style={{ fontSize: 11, color: T.txt3, marginTop: 2 }}>SAT · CFF · LISR · LIVA · LSS · RMF 2026</p>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {["ISR", "IVA", "IMSS", "CFDI", "DIOT", "CONT"].map(t => (
                  <span key={t} style={{ fontSize: 9, fontWeight: 700, color: tipoObl[t], background: `${tipoObl[t]}15`, padding: "3px 8px", borderRadius: 5 }}>{t}</span>
                ))}
              </div>
            </div>
            {obligaciones.map(o => (
              <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 20px", borderBottom: `1px solid ${T.border}`, transition: "background 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div style={{ width: 90, flexShrink: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: o.urgente ? T.amber : T.txt2, fontFamily: fontDisp }}>{o.fecha}</p>
                  <p style={{ fontSize: 9, color: T.txt3, marginTop: 2 }}>{o.periodicidad}</p>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: tipoObl[o.tipo], background: `${tipoObl[o.tipo]}15`, padding: "3px 10px", borderRadius: 5, width: 52, textAlign: "center", flexShrink: 0 }}>{o.tipo}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, color: T.txt, fontWeight: 600, fontFamily: fontDisp }}>{o.desc}</p>
                  <p style={{ fontSize: 10, color: T.txt3, marginTop: 3, fontStyle: "italic" }}>{o.articulo}</p>
                </div>
                {o.urgente && (
                  <span style={{ fontSize: 9, color: T.amber, background: `${T.amber}15`, border: `1px solid ${T.amber}30`, padding: "3px 8px", borderRadius: 5, fontWeight: 700, flexShrink: 0 }}>URGENTE</span>
                )}
                <span style={{ fontSize: 10, fontWeight: 700, color: statusObl[o.status], background: `${statusObl[o.status]}15`, padding: "4px 12px", borderRadius: 6, flexShrink: 0 }}>{o.status}</span>
              </div>
            ))}
          </G>

          {/* Legal notice */}
          <G style={{ padding: "14px 18px" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <Scale size={18} color={T.txt3} style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: 11, color: T.txt3, lineHeight: 1.7, fontFamily: font }}>
                Fechas conforme al <strong style={{ color: T.txt2 }}>Código Fiscal de la Federación (CFF)</strong>, <strong style={{ color: T.txt2 }}>Ley del ISR</strong>, <strong style={{ color: T.txt2 }}>Ley del IVA</strong> y <strong style={{ color: T.txt2 }}>Resolución Miscelánea Fiscal 2026</strong>. Las fechas de vencimiento se recorren al día hábil siguiente cuando caen en sábado, domingo o día inhábil. Verificar el <strong style={{ color: T.accent }}>Buzón Tributario</strong> del SAT para notificaciones adicionales.
              </p>
            </div>
          </G>
        </div>
      )}

      {/* ═══════════════════════════════
          TAB 4: CUENTAS CxC / CxP
          ═══════════════════════════════ */}
      {tab === "cuentas" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {[{ id: "cobrar", l: "Cuentas por Cobrar (CxC)" }, { id: "pagar", l: "Cuentas por Pagar (CxP)" }].map(t => (
              <button key={t.id} onClick={() => setCxTab(t.id)} style={{ padding: "9px 22px", borderRadius: 9, border: `1px solid ${cxTab === t.id ? T.accent + "50" : T.border}`, background: cxTab === t.id ? T.accentS : T.glass, color: cxTab === t.id ? T.accent : T.txt2, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp, transition: "all 0.2s" }}>
                {t.l}
              </button>
            ))}
          </div>

          {cxTab === "cobrar" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                {[
                  { l: "Total por Cobrar", v: fmt(totalCXC), c: T.emerald, i: Wallet },
                  { l: "Al Corriente", v: fmt(cxcData.filter(c => c.status === "Vigente").reduce((s, c) => s + c.monto, 0)), c: T.accent, i: CheckCircle2 },
                  { l: "Vencidas", v: fmt(cxcVencidas), c: T.rose, i: AlertCircle },
                  { l: "Cobradas este mes", v: fmt(cxcData.filter(c => c.status === "Pagada").reduce((s, c) => s + c.monto, 0)), c: T.blue, i: Check },
                ].map(k => (
                  <G key={k.l} hover style={{ padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <p style={{ fontSize: 10, color: T.txt2, fontWeight: 600 }}>{k.l}</p>
                      <Ico icon={k.i} sz={26} is={12} c={k.c} />
                    </div>
                    <p style={{ fontSize: 22, fontWeight: 300, color: "#FFF", fontFamily: fontDisp, letterSpacing: "-0.04em" }}>{k.v}</p>
                  </G>
                ))}
              </div>
              <G np>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.8fr 0.8fr 0.7fr 0.7fr", gap: 8, padding: "10px 20px", borderBottom: `1px solid ${T.border}`, fontSize: 9, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
                  <span>Cliente / RFC</span><span>Factura</span><span>Monto</span><span>Vencimiento</span><span>Días</span><span>Status</span>
                </div>
                {cxcData.map(c => (
                  <div key={c.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.8fr 0.8fr 0.7fr 0.7fr", gap: 8, alignItems: "center", padding: "13px 20px", borderBottom: `1px solid ${T.border}`, transition: "background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <div>
                      <p style={{ fontSize: 12, color: T.txt, fontWeight: 600, fontFamily: fontDisp }}>{c.cliente}</p>
                      <p style={{ fontSize: 9, color: T.txt3, fontFamily: "monospace", marginTop: 2 }}>{c.rfc}</p>
                    </div>
                    <span style={{ fontSize: 11, color: T.accent, fontFamily: fontDisp, fontWeight: 600 }}>{c.factura}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: T.emerald, fontFamily: fontDisp }}>{fmt(c.monto)}</span>
                    <span style={{ fontSize: 11, color: T.txt2 }}>{c.vencimiento}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: c.diasVenc > 0 ? T.rose : T.emerald, fontFamily: fontDisp }}>
                      {c.diasVenc > 0 ? `+${c.diasVenc}d` : `${Math.abs(c.diasVenc)}d`}
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: statusCX[c.status], background: `${statusCX[c.status]}15`, padding: "3px 8px", borderRadius: 5, textAlign: "center" }}>{c.status}</span>
                  </div>
                ))}
              </G>
            </>
          )}

          {cxTab === "pagar" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {[
                  { l: "Total por Pagar", v: fmt(totalCXP), c: T.rose, i: CreditCard },
                  { l: "Vencen esta semana", v: fmt(cxpData.filter(c => c.status === "Pendiente").slice(0, 2).reduce((s, c) => s + c.monto, 0)), c: T.amber, i: AlertTriangle },
                  { l: "Pagadas este mes", v: fmt(cxpData.filter(c => c.status === "Pagada").reduce((s, c) => s + c.monto, 0)), c: T.emerald, i: CheckSquare },
                ].map(k => (
                  <G key={k.l} hover style={{ padding: 14, display: "flex", alignItems: "center", gap: 14 }}>
                    <Ico icon={k.i} sz={36} is={16} c={k.c} />
                    <div>
                      <p style={{ fontSize: 10, color: T.txt2, fontWeight: 600, marginBottom: 4 }}>{k.l}</p>
                      <p style={{ fontSize: 22, fontWeight: 300, color: "#FFF", fontFamily: fontDisp, letterSpacing: "-0.04em" }}>{k.v}</p>
                    </div>
                  </G>
                ))}
              </div>
              <G np>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 0.8fr 0.8fr 0.7fr", gap: 8, padding: "10px 20px", borderBottom: `1px solid ${T.border}`, fontSize: 9, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
                  <span>Proveedor / RFC</span><span>Concepto</span><span>Monto</span><span>Vencimiento</span><span>Status</span>
                </div>
                {cxpData.map(c => (
                  <div key={c.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 0.8fr 0.8fr 0.7fr", gap: 8, alignItems: "center", padding: "13px 20px", borderBottom: `1px solid ${T.border}`, transition: "background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <div>
                      <p style={{ fontSize: 12, color: T.txt, fontWeight: 600, fontFamily: fontDisp }}>{c.proveedor}</p>
                      <p style={{ fontSize: 9, color: T.txt3, fontFamily: "monospace", marginTop: 2 }}>{c.rfc}</p>
                    </div>
                    <p style={{ fontSize: 11, color: T.txt2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.concepto}</p>
                    <span style={{ fontSize: 13, fontWeight: 700, color: T.rose, fontFamily: fontDisp }}>{fmt(c.monto)}</span>
                    <span style={{ fontSize: 11, color: T.txt2 }}>{c.vencimiento}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: statusCX[c.status] || T.txt3, background: `${(statusCX[c.status] || T.txt3)}15`, padding: "3px 8px", borderRadius: 5, textAlign: "center" }}>{c.status}</span>
                  </div>
                ))}
              </G>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════
          TAB 5: FLUJO DE CAJA
          ═══════════════════════════════ */}
      {tab === "flujo" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { l: "Ingresos Año 2026", v: fmt(flujoData.reduce((s, d) => s + d.ingresos, 0)), sub: "proyectado", c: T.emerald, i: TrendingUp },
              { l: "Egresos Año 2026", v: fmt(flujoData.reduce((s, d) => s + d.egresos, 0)), sub: "proyectado", c: T.rose, i: TrendingDown },
              { l: "Utilidad Neta", v: fmt(flujoData.reduce((s, d) => s + d.saldo, 0)), sub: "antes ISR", c: T.accent, i: PiggyBank },
              { l: "Margen Operativo", v: fmtPct(flujoData.reduce((s, d) => s + d.saldo, 0) / flujoData.reduce((s, d) => s + d.ingresos, 0) * 100), sub: "utilidad/ingreso", c: T.blue, i: Percent },
            ].map(k => (
              <G key={k.l} hover style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <p style={{ fontSize: 10, color: T.txt2, fontWeight: 600, lineHeight: 1.4 }}>{k.l}</p>
                  <Ico icon={k.i} sz={28} is={13} c={k.c} />
                </div>
                <p style={{ fontSize: 24, fontWeight: 300, color: "#FFF", fontFamily: fontDisp, letterSpacing: "-0.04em" }}>{k.v}</p>
                <p style={{ fontSize: 10, color: k.c, fontWeight: 600, marginTop: 6 }}>{k.sub}</p>
              </G>
            ))}
          </div>

          <G>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>Proyección de Flujo de Caja — 2026</p>
                <p style={{ fontSize: 11, color: T.txt3, marginTop: 2 }}>Ingresos, egresos y saldo neto mensual</p>
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                {[{ c: T.emerald, l: "Ingresos" }, { c: T.rose, l: "Egresos" }, { c: T.accent, l: "Saldo Neto" }].map(l => (
                  <div key={l.l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 10, height: 3, borderRadius: 2, background: l.c }} />
                    <span style={{ fontSize: 11, color: T.txt3 }}>{l.l}</span>
                  </div>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={flujoData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }} barGap={3}>
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: T.txt3 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: T.txt3 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v / 1000}K`} />
                <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11 }} formatter={v => [`$${v.toLocaleString("es-MX")}`, ""]} />
                <Bar dataKey="ingresos" fill={T.emerald} radius={[4, 4, 0, 0]} name="Ingresos" opacity={0.85} />
                <Bar dataKey="egresos" fill={T.rose} radius={[4, 4, 0, 0]} name="Egresos" opacity={0.85} />
                <Bar dataKey="saldo" fill={T.accent} radius={[4, 4, 0, 0]} name="Saldo" opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </G>

          {/* Tabla detalle por mes */}
          <G np>
            <div style={{ padding: "12px 20px", borderBottom: `1px solid ${T.border}` }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: T.txt, fontFamily: fontDisp }}>Detalle Mensual</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 8, padding: "9px 20px", borderBottom: `1px solid ${T.border}`, fontSize: 9, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
              <span>Mes</span><span>Ingresos</span><span>Egresos</span><span>Saldo Neto</span><span>Margen</span>
            </div>
            {flujoData.map((d, i) => {
              const margen = ((d.saldo / d.ingresos) * 100).toFixed(1);
              return (
                <div key={d.mes} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 8, alignItems: "center", padding: "11px 20px", borderBottom: `1px solid ${T.border}`, background: i < 4 ? "rgba(255,255,255,0.01)" : "transparent", transition: "background 0.15s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: T.txt, fontWeight: 600, fontFamily: fontDisp }}>{d.mes} 2026</span>
                    {i < 4 && <span style={{ fontSize: 9, color: T.accent, background: `${T.accent}12`, padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>Real</span>}
                    {i >= 4 && <span style={{ fontSize: 9, color: T.txt3, background: "rgba(255,255,255,0.04)", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>Proy.</span>}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.emerald, fontFamily: fontDisp }}>{fmt(d.ingresos)}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.rose, fontFamily: fontDisp }}>{fmt(d.egresos)}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.accent, fontFamily: fontDisp }}>{fmt(d.saldo)}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: T.border, overflow: "hidden" }}>
                      <div style={{ width: `${margen}%`, height: "100%", background: T.accent, borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 10, color: T.accent, fontWeight: 600, fontFamily: fontDisp, width: 34, textAlign: "right" }}>{margen}%</span>
                  </div>
                </div>
              );
            })}
          </G>
        </div>
      )}

      {/* Modal CFDI */}
      {showNewCFDI && <NewCFDIModal />}

    </div>
  );
};

export default FinanzasAdmin;
