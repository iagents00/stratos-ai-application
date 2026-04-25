/**
 * app/features/Admin/AdminPanel.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Panel de gestión de usuarios (Super Admin y Admin).
 * Extraído de App.jsx.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import {
  Search, Plus, X, User, CheckCircle2, Trash2
} from "lucide-react";
import { P, font, fontDisp } from "../../../design-system/tokens";
import { useAuth } from "../../../hooks/useAuth";
import { adminGetAllUsers, adminCreateUser, adminUpdateUser, adminDeleteUser, adminResetPassword } from "../../../lib/auth";
import { G } from "../../SharedComponents";
import { ROLE_META, RoleBadge } from "./RoleBadge";

export default function AdminPanel() {
  const { user: me } = useAuth();
  const [users, setUsers]           = useState(() => adminGetAllUsers());
  const [search, setSearch]         = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [modal, setModal]           = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [form, setForm]             = useState({});
  const [formErr, setFormErr]       = useState("");
  const [formOk, setFormOk]         = useState("");

  const isSuper = me?.role === "super_admin";
  const canManage = ["super_admin", "admin"].includes(me?.role);

  const refresh = () => setUsers(adminGetAllUsers());

  const sf = (k) => (v) => setForm(p => ({ ...p, [k]: typeof v === "string" ? v : v.target.value }));

  const openCreate = () => {
    setForm({ name: "", email: "", password: "", role: "asesor", isActive: true });
    setFormErr(""); setFormOk("");
    setModal({ mode: "create" });
  };

  const openEdit = (u) => {
    setForm({ name: u.name, email: u.email, role: u.role, isActive: u.isActive !== false });
    setFormErr(""); setFormOk("");
    setModal({ mode: "edit", user: u });
  };

  const openReset = (u) => {
    setForm({ password: "" });
    setFormErr(""); setFormOk("");
    setModal({ mode: "reset", user: u });
  };

  const handleCreate = () => {
    if (!form.name?.trim()) { setFormErr("El nombre es requerido."); return; }
    if (!form.email?.trim() || !form.email.includes("@")) { setFormErr("Email inválido."); return; }
    if (!form.password || form.password.length < 6) { setFormErr("La contraseña debe tener al menos 6 caracteres."); return; }
    const { data, error } = adminCreateUser({ name: form.name.trim(), email: form.email.trim().toLowerCase(), password: form.password, role: form.role });
    if (error) { setFormErr(error); return; }
    refresh(); setFormOk(`Usuario ${data.name} creado exitosamente.`);
    setTimeout(() => setModal(null), 1400);
  };

  const handleEdit = () => {
    if (!form.name?.trim()) { setFormErr("El nombre es requerido."); return; }
    const { data, error } = adminUpdateUser(modal.user.id, { name: form.name.trim(), email: form.email.trim().toLowerCase(), role: form.role, isActive: form.isActive });
    if (error) { setFormErr(error); return; }
    refresh(); setFormOk("Cambios guardados."); setTimeout(() => setModal(null), 1000);
  };

  const handleReset = () => {
    if (!form.password || form.password.length < 6) { setFormErr("Mínimo 6 caracteres."); return; }
    const { error } = adminResetPassword(modal.user.id, form.password);
    if (error) { setFormErr(error); return; }
    setFormOk("Contraseña actualizada."); setTimeout(() => setModal(null), 1000);
  };

  const handleDelete = (id) => {
    const { error } = adminDeleteUser(id, me?.id);
    if (error) return;
    setDeleteConfirm(null); refresh();
  };

  const handleToggleActive = (u) => {
    adminUpdateUser(u.id, { isActive: !u.isActive }); refresh();
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchQ = !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    const matchR = roleFilter === "ALL" || u.role === roleFilter;
    return matchQ && matchR;
  });

  const stats = Object.entries(ROLE_META).map(([key, m]) => ({
    ...m, key, count: users.filter(u => u.role === key).length,
  })).filter(s => s.count > 0);

  const availableRoles = Object.entries(ROLE_META)
    .filter(([key]) => isSuper || ROLE_META[key].level > (ROLE_META[me?.role]?.level ?? 99))
    .map(([key, m]) => ({ key, ...m }));

  const inputStyle = {
    width: "100%", height: 40, padding: "0 14px", borderRadius: 11,
    background: P.glass, border: `1px solid ${P.border}`, color: P.txt,
    fontSize: 13, outline: "none", fontFamily: font, boxSizing: "border-box",
    transition: "border-color 0.2s",
  };

  return (
    <div style={{ padding: "28px 28px 0", display: "flex", flexDirection: "column", gap: 20, height: "100%" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.025em", margin: 0 }}>Gestión de Usuarios</h2>
            <span style={{ fontSize: 10, fontWeight: 700, color: P.txt3, background: P.glass, border: `1px solid ${P.border}`, padding: "3px 9px", borderRadius: 99, letterSpacing: "0.06em" }}>{users.length} usuarios</span>
          </div>
          <p style={{ fontSize: 11.5, color: P.txt3, margin: 0 }}>
            {users.filter(u => u.isActive !== false).length} activos · {users.filter(u => u.isActive === false).length} inactivos
          </p>
        </div>
        {canManage && (
          <button onClick={openCreate} style={{
            display: "flex", alignItems: "center", gap: 7, padding: "10px 20px",
            borderRadius: 11, background: "linear-gradient(135deg, rgba(110,231,194,0.16), rgba(110,231,194,0.07))",
            border: `1px solid ${P.accentB}`, color: P.accent, fontSize: 12.5, fontWeight: 700,
            fontFamily: fontDisp, cursor: "pointer", transition: "all 0.2s", flexShrink: 0,
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(110,231,194,0.24), rgba(110,231,194,0.12))"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(110,231,194,0.16), rgba(110,231,194,0.07))"; }}
          ><Plus size={14} /> Nuevo Usuario</button>
        )}
      </div>

      {/* ── Role stats strip ── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {stats.map(s => (
          <div key={s.key} onClick={() => setRoleFilter(roleFilter === s.key ? "ALL" : s.key)}
            style={{
              display: "flex", alignItems: "center", gap: 9, padding: "10px 16px",
              borderRadius: 12, background: roleFilter === s.key ? `${s.color}10` : P.glass,
              border: `1px solid ${roleFilter === s.key ? `${s.color}35` : P.border}`,
              cursor: "pointer", transition: "all 0.18s",
            }}
            onMouseEnter={e => { if (roleFilter !== s.key) e.currentTarget.style.borderColor = P.borderH; }}
            onMouseLeave={e => { if (roleFilter !== s.key) e.currentTarget.style.borderColor = P.border; }}
          >
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: roleFilter === s.key ? s.color : P.txt2 }}>{s.label}</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: roleFilter === s.key ? s.color : "#FFFFFF", fontFamily: fontDisp }}>{s.count}</span>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <G np>
        <div style={{ padding: "12px 18px", borderBottom: `1px solid ${P.border}`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 160, maxWidth: 300 }}>
            <Search size={12} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: P.txt3, pointerEvents: "none" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nombre o email…"
              style={{ ...inputStyle, paddingLeft: 30, height: 34, fontSize: 12 }}
              onFocus={e => e.target.style.borderColor = P.accentB}
              onBlur={e => e.target.style.borderColor = P.border}
            />
          </div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ height: 34, padding: "0 12px", borderRadius: 9, background: P.glass, border: `1px solid ${P.border}`, fontSize: 11, color: P.txt3, cursor: "pointer", outline: "none", fontFamily: font }}>
            <option value="ALL">Todos los roles</option>
            {Object.entries(ROLE_META).map(([k, m]) => <option key={k} value={k} style={{ background: "#111318" }}>{m.label}</option>)}
          </select>
          {(search || roleFilter !== "ALL") && (
            <button onClick={() => { setSearch(""); setRoleFilter("ALL"); }} style={{ height: 34, padding: "0 12px", borderRadius: 9, background: `${P.rose}0C`, border: `1px solid ${P.rose}28`, color: P.rose, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: font, display: "flex", alignItems: "center", gap: 5 }}>
              <X size={11} /> Limpiar
            </button>
          )}
          <span style={{ marginLeft: "auto", fontSize: 11, color: P.txt3 }}>{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* ── Table header ── */}
        <div style={{ display: "grid", gridTemplateColumns: "2.2fr 2fr 1fr 1fr 100px", gap: 0, padding: "9px 20px", borderBottom: `1px solid ${P.border}` }}>
          {["Usuario", "Email", "Rol", "Estado", "Acciones"].map((h, i) => (
            <span key={h} style={{ fontSize: 9, fontWeight: 700, color: P.txt3, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: i === 4 ? "center" : "left" }}>{h}</span>
          ))}
        </div>

        {/* ── User rows ── */}
        <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 380px)" }}>
          {filtered.length === 0 && (
            <div style={{ padding: "48px 0", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: P.txt3 }}>No se encontraron usuarios.</p>
            </div>
          )}
          {filtered.map((u, idx) => {
            const m = ROLE_META[u.role] || { label: u.role, color: P.txt3 };
            const active = u.isActive !== false;
            const isMe = u.id === me?.id;
            const canEdit = canManage && (isSuper || (ROLE_META[u.role]?.level ?? 99) > (ROLE_META[me?.role]?.level ?? 0));
            const initials = (u.name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
            const avatarColors = ["#A78BFA", "#7EB8F0", "#6EE7C2", "#F59E0B", "#5DC8D9", "#E8818C"];
            const ac = avatarColors[u.id % avatarColors.length];
            return (
              <div key={u.id} style={{
                display: "grid", gridTemplateColumns: "2.2fr 2fr 1fr 1fr 100px",
                padding: "13px 20px", borderBottom: idx < filtered.length - 1 ? `1px solid ${P.border}` : "none",
                background: "transparent", transition: "background 0.15s", alignItems: "center",
              }}
                onMouseEnter={e => e.currentTarget.style.background = P.glass}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                {/* Name + avatar */}
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: `${ac}18`, border: `1.5px solid ${ac}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: ac, fontFamily: fontDisp, flexShrink: 0 }}>{initials}</div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: active ? "#FFFFFF" : P.txt3, fontFamily: fontDisp, letterSpacing: "-0.01em" }}>
                      {u.name}
                      {isMe && <span style={{ fontSize: 9, color: P.accent, fontWeight: 700, marginLeft: 7, background: `${P.accent}12`, border: `1px solid ${P.accentB}`, padding: "1px 7px", borderRadius: 99 }}>Tú</span>}
                    </p>
                    <p style={{ fontSize: 10.5, color: P.txt3, marginTop: 1 }}>ID #{u.id}</p>
                  </div>
                </div>

                {/* Email */}
                <span style={{ fontSize: 12, color: active ? P.txt2 : P.txt3, fontFamily: font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 12 }}>{u.email}</span>

                {/* Role */}
                <RoleBadge role={u.role} />

                {/* Status */}
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: active ? P.emerald : P.txt3, boxShadow: active ? `0 0 6px ${P.emerald}80` : "none" }} />
                  <span style={{ fontSize: 11, color: active ? P.txt2 : P.txt3, fontWeight: active ? 600 : 400 }}>{active ? "Activo" : "Inactivo"}</span>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                  {canEdit ? (
                    <>
                      <button onClick={() => openEdit(u)} title="Editar usuario" style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${P.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(126,184,240,0.1)"; e.currentTarget.style.borderColor = "rgba(126,184,240,0.35)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = P.border; }}
                      ><User size={12} color={P.blue} /></button>
                      <button onClick={() => handleToggleActive(u)} title={active ? "Desactivar" : "Activar"} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${P.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = active ? "rgba(232,129,140,0.1)" : "rgba(110,231,194,0.1)"; e.currentTarget.style.borderColor = active ? "rgba(232,129,140,0.35)" : "rgba(110,231,194,0.35)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = P.border; }}
                      >{active ? <X size={12} color={P.rose} /> : <CheckCircle2 size={12} color={P.emerald} />}</button>
                      {!isMe && (
                        <button onClick={() => setDeleteConfirm(u.id)} title="Eliminar usuario" style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${P.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                          onMouseEnter={e => { e.currentTarget.style.background = "rgba(232,129,140,0.1)"; e.currentTarget.style.borderColor = "rgba(232,129,140,0.35)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = P.border; }}
                        ><Trash2 size={12} color={P.rose} /></button>
                      )}
                    </>
                  ) : (
                    <span style={{ fontSize: 10, color: P.txt3, fontStyle: "italic" }}>—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </G>

      {/* ── Delete confirmation ── */}
      {deleteConfirm !== null && createPortal(
        <>
          <div onClick={() => setDeleteConfirm(null)} style={{ position: "fixed", inset: 0, background: "rgba(2,5,12,0.78)", backdropFilter: "blur(8px)", zIndex: 500 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 501, width: "min(400px, 92vw)", background: "#111318", border: `1px solid ${P.rose}30`, borderRadius: 20, boxShadow: "0 32px 64px rgba(0,0,0,0.7)", padding: "26px 28px", animation: "fadeIn 0.2s ease" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${P.rose}12`, border: `1px solid ${P.rose}28`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Trash2 size={20} color={P.rose} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, marginBottom: 8 }}>¿Eliminar usuario?</p>
            <p style={{ fontSize: 12.5, color: P.txt3, lineHeight: 1.6, marginBottom: 22 }}>
              Esta acción es permanente. El usuario perderá acceso inmediatamente y no podrá recuperarse.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, height: 40, borderRadius: 10, background: "transparent", border: `1px solid ${P.border}`, color: P.txt3, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font }}>Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ flex: 1, height: 40, borderRadius: 10, background: `${P.rose}14`, border: `1px solid ${P.rose}35`, color: P.rose, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: fontDisp }}>Eliminar</button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* ── Create / Edit / Reset modal ── */}
      {modal !== null && createPortal(
        <>
          <div onClick={() => setModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(2,5,12,0.78)", backdropFilter: "blur(8px)", zIndex: 500 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 501, width: "min(500px, 94vw)", background: "#111318", border: `1px solid ${P.borderH}`, borderRadius: 22, boxShadow: "0 48px 96px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)", animation: "fadeIn 0.22s ease" }}>
            <div style={{ height: 3, background: `linear-gradient(90deg, ${P.accent}, ${P.accent}40)`, borderRadius: "22px 22px 0 0" }} />
            <div style={{ padding: "22px 26px 18px", borderBottom: `1px solid ${P.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.02em", marginBottom: 3 }}>
                  {modal.mode === "create" ? "Crear Nuevo Usuario" : modal.mode === "reset" ? "Restablecer Contraseña" : `Editar: ${modal.user?.name}`}
                </p>
                <p style={{ fontSize: 11, color: P.txt3 }}>
                  {modal.mode === "create" ? "El usuario podrá iniciar sesión inmediatamente." : modal.mode === "reset" ? "Define una nueva contraseña temporal." : "Modifica los datos y el rol del usuario."}
                </p>
              </div>
              <button onClick={() => setModal(null)} style={{ width: 32, height: 32, borderRadius: 9, border: `1px solid ${P.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                onMouseEnter={e => e.currentTarget.style.background = P.glass}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              ><X size={14} color={P.txt3} /></button>
            </div>

            <div style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 15 }}>
              {modal.mode !== "reset" && (
                <>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, color: P.txt3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7 }}>Nombre completo <span style={{ color: P.accent }}>*</span></p>
                    <input value={form.name || ""} onChange={e => sf("name")(e.target.value)} placeholder="Ej. María González" style={inputStyle}
                      onFocus={e => e.target.style.borderColor = P.accentB}
                      onBlur={e => e.target.style.borderColor = P.border}
                    />
                  </div>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, color: P.txt3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7 }}>Email <span style={{ color: P.accent }}>*</span></p>
                    <input value={form.email || ""} onChange={e => sf("email")(e.target.value)} placeholder="maria@stratos.ai" type="email" style={inputStyle}
                      onFocus={e => e.target.style.borderColor = P.accentB}
                      onBlur={e => e.target.style.borderColor = P.border}
                    />
                  </div>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, color: P.txt3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7 }}>Rol</p>
                    <select value={form.role || "asesor"} onChange={e => sf("role")(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}
                      onFocus={e => e.target.style.borderColor = P.accentB}
                      onBlur={e => e.target.style.borderColor = P.border}
                    >
                      {availableRoles.map(r => (
                        <option key={r.key} value={r.key} style={{ background: "#111318" }}>{r.label} — Nivel {r.level}</option>
                      ))}
                    </select>
                    <p style={{ fontSize: 10, color: P.txt3, marginTop: 5 }}>
                      {ROLE_META[form.role]?.level === 1 && "Acceso total al sistema. Puede crear y eliminar cualquier usuario."}
                      {ROLE_META[form.role]?.level === 2 && "Acceso administrativo. Gestiona directores y asesores."}
                      {ROLE_META[form.role]?.level === 3 && "Acceso ejecutivo. Ve KPIs globales y métricas del equipo."}
                      {ROLE_META[form.role]?.level === 4 && "Acceso de gestión. Supervisa su equipo de asesores."}
                      {ROLE_META[form.role]?.level === 5 && "Acceso personal. Ve solo sus propios clientes y registros."}
                    </p>
                  </div>
                </>
              )}

              {modal.mode === "create" && (
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: P.txt3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7 }}>Contraseña inicial <span style={{ color: P.accent }}>*</span></p>
                  <input value={form.password || ""} onChange={e => sf("password")(e.target.value)} placeholder="Mínimo 6 caracteres" type="password" style={inputStyle}
                    onFocus={e => e.target.style.borderColor = P.accentB}
                    onBlur={e => e.target.style.borderColor = P.border}
                  />
                </div>
              )}

              {modal.mode === "reset" && (
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: P.txt3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7 }}>Nueva contraseña <span style={{ color: P.accent }}>*</span></p>
                  <input value={form.password || ""} onChange={e => sf("password")(e.target.value)} placeholder="Nueva contraseña (mín. 6 caracteres)" type="password" style={inputStyle}
                    onFocus={e => e.target.style.borderColor = P.accentB}
                    onBlur={e => e.target.style.borderColor = P.border}
                  />
                  <p style={{ fontSize: 10.5, color: P.txt3, marginTop: 8 }}>Reseteando contraseña para: <span style={{ color: P.txt2 }}>{modal.user?.name}</span></p>
                </div>
              )}

              {modal.mode === "edit" && (
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: P.txt3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 9 }}>Estado de la cuenta</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[{ v: true, label: "Activo", c: P.emerald }, { v: false, label: "Inactivo", c: P.rose }].map(o => (
                      <button key={String(o.v)} onClick={() => sf("isActive")(o.v)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: font, transition: "all 0.18s", background: form.isActive === o.v ? `${o.c}14` : "transparent", border: `1px solid ${form.isActive === o.v ? `${o.c}40` : P.border}`, color: form.isActive === o.v ? o.c : P.txt3 }}>{o.label}</button>
                    ))}
                  </div>
                </div>
              )}

              {modal.mode === "edit" && (
                <button onClick={() => openReset(modal.user)} style={{ padding: "9px 0", borderRadius: 10, background: "transparent", border: `1px solid ${P.amber}28`, color: P.amber, fontSize: 11.5, fontWeight: 600, fontFamily: font, cursor: "pointer", transition: "all 0.18s" }}
                  onMouseEnter={e => e.currentTarget.style.background = `${P.amber}0C`}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >Restablecer contraseña</button>
              )}

              {formErr && <p style={{ fontSize: 11.5, color: P.rose, background: `${P.rose}0C`, border: `1px solid ${P.rose}22`, padding: "10px 14px", borderRadius: 10 }}>{formErr}</p>}
              {formOk  && <p style={{ fontSize: 11.5, color: P.emerald, background: `${P.emerald}0C`, border: `1px solid ${P.emerald}22`, padding: "10px 14px", borderRadius: 10 }}>{formOk}</p>}
            </div>

            <div style={{ padding: "16px 26px", borderTop: `1px solid ${P.border}`, display: "flex", gap: 10 }}>
              <button onClick={() => setModal(null)} style={{ flex: 1, height: 42, borderRadius: 12, background: "transparent", border: `1px solid ${P.border}`, color: P.txt3, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font, transition: "all 0.18s" }}>Cancelar</button>
              <button
                onClick={modal.mode === "create" ? handleCreate : modal.mode === "reset" ? handleReset : handleEdit}
                style={{ flex: 2, height: 42, borderRadius: 12, background: `${P.accent}16`, border: `1px solid ${P.accentB}`, color: P.accent, fontSize: 13, fontWeight: 700, fontFamily: fontDisp, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, transition: "background 0.18s" }}
                onMouseEnter={e => e.currentTarget.style.background = `${P.accent}24`}
                onMouseLeave={e => e.currentTarget.style.background = `${P.accent}16`}
              >
                {modal.mode === "create" ? <><Plus size={14} /> Crear Usuario</> : modal.mode === "reset" ? <><CheckCircle2 size={14} /> Guardar Contraseña</> : <><CheckCircle2 size={14} /> Guardar Cambios</>}
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
