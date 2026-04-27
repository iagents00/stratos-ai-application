/**
 * app/App.jsx — Shell principal de Stratos IA
 * ─────────────────────────────────────────────────────────────────────────────
 * Únicamente contiene: estado global, Sidebar, Header, BottomNav, view routing.
 * Todos los componentes y lógica de negocio viven en sus propios módulos.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useRef, useCallback, useMemo, startTransition, lazy, Suspense } from "react";
import { supabase } from "../lib/supabase";
import LoginScreen from "../landing/LoginScreen.jsx";
import PricingScreen from "../landing/PricingScreen.jsx";
import { useAuth } from "../hooks/useAuth";
import {
  getOfflineLeads,
  updateOfflineLead,
  getPendingSyncCount,
  syncToSupabase,
  pingSupabase,
  silentSignIn,
} from "../lib/offline-mode";

import {
  Search, Bell, Settings, LogOut, Sun, Moon, ChevronDown, ChevronsDown,
} from "lucide-react";
import "./App.css";

/* ── Design system ── */
import { font, fontDisp } from "../design-system/tokens";

/* ── Feature components ── */
import { StratosAtomHex } from "./components/Logo";
import DynIsland          from "./components/DynIsland";
import IAOSIsland         from "./components/IAOSIsland";
import PermissionGate     from "./components/PermissionGate";
import Chat, { getResp }  from "./features/ChatPanel";
import MetaPanel,
  { DEFAULT_META_PLAN, DEFAULT_META_PROTOCOL } from "./features/MetaPanel";
// AdminPanel y vistas pesadas se cargan bajo demanda con React.lazy
// para reducir el bundle inicial de ~1.3 MB a ~400 KB.
const AdminPanel = lazy(() => import("./features/Admin/AdminPanel"));

/* ── Navigation & roles ── */
import { nav, MODULE_ROLES } from "./constants/navigation";

/* ── Views ──
 * Dash y CRM son las que se ven inmediatamente al entrar → carga eager.
 * El resto se carga bajo demanda al cambiar de pestaña (code splitting). */
import Dash          from "./views/Dash";
import CRM           from "./views/CRM";
const ERP           = lazy(() => import("./views/ERP"));
const Team          = lazy(() => import("./views/Team"));
const IACRM         = lazy(() => import("./views/IACRM"));
const LandingPages  = lazy(() => import("./views/LandingPages"));
const FinanzasAdmin = lazy(() => import("./views/FinanzasAdmin"));
const RRHHModule    = lazy(() => import("./views/RRHHModule"));

/* ── Mock data (demo fallback) ── */
import { leads } from "./data/leads";

/* ════════════════════════════════════════
   DESIGN TOKENS — Dark & Light palettes
   ════════════════════════════════════════ */
const P = {
  bg: "#030810", glass: "rgba(255,255,255,0.032)",
  glassH: "rgba(255,255,255,0.052)", border: "rgba(255,255,255,0.07)",
  borderH: "rgba(255,255,255,0.12)", surface: "#091225",
  accent: "#6EE7C2", accentS: "rgba(110,231,194,0.07)",
  accentB: "rgba(110,231,194,0.12)", blue: "#7EB8F0",
  violet: "#A78BFA", amber: "#67B7D1", rose: "#9B8EFF",
  emerald: "#6DD4A8", cyan: "#5DC8D9",
  txt: "#E2E8F0", txt2: "#8B99AE", txt3: "#4A5568",
  r: 16, rs: 10, rx: 6,
};

const LP = {
  bg: "#EDF3F0", bgSoft: "#F6FAF8", bgCool: "#EAF0EE",
  glass: "rgba(255,255,255,0.70)", glassH: "rgba(255,255,255,0.92)",
  glassStrong: "rgba(255,255,255,0.96)",
  glassMint: "rgba(236,251,246,0.75)",
  border: "rgba(15,23,42,0.08)", borderH: "rgba(15,23,42,0.16)",
  borderMint: "rgba(15,158,122,0.18)", surface: "#FFFFFF",
  accent: "#0D9A76", accentDark: "#067A5E",
  accentS: "rgba(13,154,118,0.08)", accentB: "rgba(13,154,118,0.28)",
  accentG: "linear-gradient(135deg, #0D9A76 0%, #14B892 50%, #34D4AA 100%)",
  blue: "#2563EB", violet: "#7C3AED", amber: "#D97706",
  rose: "#E11D48", emerald: "#059669", cyan: "#0891B2",
  txt: "#0B1220", txt2: "#3B4A61", txt3: "#7A8699",
  shadow1: "0 1px 2px rgba(15,23,42,0.05), 0 2px 4px rgba(15,23,42,0.04)",
  shadow2: "0 1px 3px rgba(15,23,42,0.06), 0 8px 24px rgba(15,23,42,0.07), 0 16px 40px rgba(15,23,42,0.04)",
  shadow3: "0 4px 12px rgba(15,23,42,0.08), 0 20px 56px rgba(15,23,42,0.10), 0 32px 80px rgba(15,23,42,0.06)",
  shadowMint: "0 2px 8px rgba(13,154,118,0.10), 0 8px 28px rgba(13,154,118,0.08)",
  r: 16, rs: 10, rx: 6,
};

/* ════════════════════════════════════════
   MAIN APP
   ════════════════════════════════════════ */
export default function App() {
  const { user, login, logout, upgradeToOnline } = useAuth();
  const isAsesorRole     = !["super_admin","admin","director","ceo"].includes(user?.role);
  const [v, setV]        = useState(isAsesorRole ? "c" : "d");
  const [co, setCo]      = useState(false);
  const [autoOpenPriority1, setAutoOpenPriority1] = useState(0);
  const [sidebarMore, setSidebarMore] = useState(false);
  const [msgs, setMsgs]  = useState([]);
  const [inp, setInp]    = useState("");
  const [notifs, setNotifs] = useState([]);

  /* ── Theme ── */
  const [theme, setThemeState] = useState(() => {
    try { return localStorage.getItem("stratos_crm_theme") || "dark"; } catch { return "dark"; }
  });
  const setTheme = useCallback((next) => {
    try { localStorage.setItem("stratos_crm_theme", next); } catch {}
    startTransition(() => setThemeState(next));
  }, []);
  const isLight = theme === "light";
  const T = isLight ? LP : P;

  /* ── Leads data — shared between Dash & CRM ── */
  const [leadsData, setLeadsData]       = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(true);

  const normalizeLeads = useCallback((rows) => rows.map(l => ({
    ...l,
    n:              l.name,
    st:             l.stage,
    sc:             l.score,
    p:              l.project,
    campana:        l.campaign,
    hot:            l.hot,
    isNew:          l.is_new,
    nextAction:     l.next_action,
    nextActionDate: l.next_action_date,
    lastActivity:   l.last_activity,
    daysInactive:   l.days_inactive ?? 0,
    seguimientos:   l.seguimientos ?? 0,
    aiAgent:        l.ai_agent,
    asesor:         l.asesor_name ?? '',
    fechaIngreso:   l.created_at
      ? new Date(l.created_at).toLocaleDateString('es-MX', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })
      : '',
    actionHistory: Array.isArray(l.action_history) ? l.action_history
      : (() => { try { return JSON.parse(l.action_history || '[]'); } catch { return []; } })(),
    tasks: Array.isArray(l.tasks) ? l.tasks
      : (() => { try { return JSON.parse(l.tasks || '[]'); } catch { return []; } })(),
    playbook: Array.isArray(l.playbook) ? l.playbook
      : (() => { try { return JSON.parse(l.playbook || '[]'); } catch { return []; } })(),
  })), []);

  const fetchLeads = useCallback(async () => {
    setLeadsLoading(true);

    // Modo offline: cargar del JSON estático + overlay localStorage
    if (user?._offline) {
      try {
        const offlineLeads = await getOfflineLeads(user);
        setLeadsData(normalizeLeads(offlineLeads));
      } catch (e) {
        console.warn('[Stratos] Error cargando leads offline:', e);
        setLeadsData([]);
      }
      setLeadsLoading(false);
      return;
    }

    // Modo online normal
    const { data, error } = await supabase
      .from('leads').select('*').is('deleted_at', null).order('created_at', { ascending: false });
    if (!error && data) {
      setLeadsData(normalizeLeads(data));
    } else if (error) {
      // Supabase falló — intentar offline como último recurso
      console.warn('[Stratos] Supabase leads falló, intentando offline:', error.message);
      try {
        const offlineLeads = await getOfflineLeads(user);
        if (offlineLeads.length > 0) setLeadsData(normalizeLeads(offlineLeads));
      } catch (_) { /* noop */ }
    }
    setLeadsLoading(false);
  }, [normalizeLeads, user]);

  useEffect(() => {
    if (!user) return;
    if (user.id === 'demo-user-local') {
      setLeadsData(leads.map(l => ({ ...l, seguimientos: l.seguimientos ?? 0 })));
      setLeadsLoading(false);
      return;
    }
    fetchLeads();
    // Solo subscribir al realtime si NO estamos offline
    if (user._offline) return;
    const ch = supabase.channel('leads-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchLeads())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [user, fetchLeads]);

  /* ── Modo offline: contador de cambios pendientes + sync ── */
  const [pendingSync, setPendingSync] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  // Mostrar banner solo a roles administrativos. Asesores nunca lo ven.
  // Trabajan fluido sin saber que estaban en modo offline.
  const ADMIN_ROLES = ["super_admin", "admin", "ceo"];
  const isAdminRole = ADMIN_ROLES.includes(user?.role);
  const showOfflineBanner = isAdminRole && (user?._offline || pendingSync > 0);

  useEffect(() => {
    const hasPending = getPendingSyncCount() > 0;
    if (!user?._offline && !hasPending) { setPendingSync(0); return; }
    const tick = () => setPendingSync(getPendingSyncCount());
    tick();
    const t = setInterval(tick, 3000);
    return () => clearInterval(t);
  }, [user?._offline]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncMsg("");
    const { ok, synced, failed } = await syncToSupabase(supabase);
    setSyncing(false);
    setPendingSync(getPendingSyncCount());
    if (ok && synced > 0) {
      setSyncMsg(`✅ ${synced} cambios sincronizados.`);
      setTimeout(() => setSyncMsg(""), 4000);
      // Refrescar de Supabase tras sync exitoso
      fetchLeads();
    } else if (failed > 0) {
      setSyncMsg(`⚠️ ${synced} ok, ${failed} fallaron. Reintenta cuando Supabase esté estable.`);
      setTimeout(() => setSyncMsg(""), 6000);
    }
  }, [fetchLeads]);

  /**
   * Auto-recovery: cada 60 s pingueamos Supabase. Cuando responde:
   *   1. Si el usuario está en modo offline, intentamos un silent sign-in
   *      con sus credenciales del equipo y lo pasamos a modo online sin
   *      que se entere (no logout, no relogin manual).
   *   2. Si hay cambios pendientes en localStorage, los sincronizamos
   *      silenciosamente sin notificación al asesor.
   *
   * También se ejecuta al recuperar foco de la ventana (window focus +
   * visibilitychange) para detectar la recuperación lo antes posible.
   */
  const autoRecoveryRunning = useRef(false);

  const runAutoRecovery = useCallback(async () => {
    if (autoRecoveryRunning.current) return;
    if (!user) return;
    if (user.id === 'demo-user-local') return;

    const hasPending = getPendingSyncCount() > 0;
    if (!user._offline && !hasPending) return;   // nada que hacer

    autoRecoveryRunning.current = true;
    try {
      const alive = await pingSupabase(supabase, 3000);
      if (!alive) return;                         // sigue caído, reintentar luego

      // 1. Si estamos offline, intentar silent sign-in para volver a online
      if (user._offline && user.email) {
        const { ok, profile } = await silentSignIn(supabase, user.email);
        if (ok && profile) {
          upgradeToOnline(profile);
          // El cambio de user disparará fetchLeads online vía effect
        }
      }

      // 2. Si hay cambios pendientes, sincronizar silenciosamente
      if (getPendingSyncCount() > 0) {
        const { ok, synced } = await syncToSupabase(supabase);
        setPendingSync(getPendingSyncCount());
        if (ok && synced > 0) {
          // Solo mostrar mensaje a admin/super (asesores no se enteran)
          if (isAdminRole) {
            setSyncMsg(`✅ ${synced} cambios sincronizados automáticamente.`);
            setTimeout(() => setSyncMsg(""), 4000);
          }
          // Refrescar leads de Supabase para tener la versión canónica
          fetchLeads();
        }
      }
    } finally {
      autoRecoveryRunning.current = false;
    }
  }, [user, upgradeToOnline, fetchLeads, isAdminRole]);

  // Ciclo periódico cada 60 s
  useEffect(() => {
    if (!user) return;
    if (user.id === 'demo-user-local') return;
    const t = setInterval(runAutoRecovery, 60_000);
    // Disparo inmediato a los 8 s del montaje (margen tras el timeout de auth)
    const initial = setTimeout(runAutoRecovery, 8_000);
    return () => { clearInterval(t); clearTimeout(initial); };
  }, [user, runAutoRecovery]);

  // Detección agresiva al recuperar foco / visibilidad
  useEffect(() => {
    const onWake = () => runAutoRecovery();
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) runAutoRecovery();
    });
    return () => {
      window.removeEventListener("focus", onWake);
    };
  }, [runAutoRecovery]);

  /* ── IAOS ticker ── */
  const [iaosIdx, setIaosIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIaosIdx(i => (i + 1) % 4), 4000);
    return () => clearInterval(t);
  }, []);

  /* ── MetaPanel state ── */
  const [metaOpen, setMetaOpen]     = useState(false);
  const [metaTab, setMetaTab]       = useState("acciones");
  const [metaActions, setMetaActions] = useState([]);
  const metaActionsSeeded = useRef(false);
  useEffect(() => {
    if (metaActionsSeeded.current || leadsData.length === 0) return;
    metaActionsSeeded.current = true;
    setMetaActions(
      leadsData.filter(l => l.nextAction).map(l => ({
        id: l.id, text: l.nextAction, lead: l.n,
        asesor: (l.asesor || '').split(' ')[0], date: l.nextActionDate,
        done: false, priority: l.hot ? 'urgente' : l.daysInactive >= 7 ? 'alto' : 'normal',
        assignee: l.asesor, assigneeType: 'human',
      }))
    );
  }, [leadsData]);
  const [metaNewText, setMetaNewText]   = useState("");
  const [doneCollapsed, setDoneCollapsed] = useState(true);
  const [metaPlan, setMetaPlan]         = useState(DEFAULT_META_PLAN);
  const [metaProtocol, setMetaProtocol] = useState(DEFAULT_META_PROTOCOL);

  /* ── Notifications ── */
  const onLogout = () => logout();

  useEffect(() => {
    if (!user) return;
    const { TrendingUp, AlertCircle, Star, Home, Banknote, Trophy } = {};
    // Notifications are defined in DynIsland defaults; this effect stays for extensibility
  }, [user]);

  /* ── oc — chat callback passed to views ── */
  const oc = useCallback((t, leadData) => {
    if (t) setTimeout(() => {
      const displayText = leadData ? `Analizar expediente de ${leadData.n}` : t;
      setMsgs(p => [...p, { role: "u", text: displayText }]);
      setTimeout(() => { setMsgs(p => [...p, { role: "a", ...getResp(t, leadData, leadsData) }]); }, 1105);
    }, 150);
  }, [leadsData]);

  /* ── Open CRM priority lead ── */
  const openPriorityLead = useCallback(() => {
    setV("c");
    setAutoOpenPriority1(n => n + 1);
  }, []);

  /* ── Dynamic CSS — memoized ── */
  const dynamicStyles = useMemo(() => `
    @keyframes agentOrbBreathe{
      0%,100%{box-shadow:0 2px 8px ${T.accent}40,0 6px 20px ${T.accent}38,0 0 0 0 ${T.accent}44,inset 0 1px 0 rgba(255,255,255,0.35),inset 0 -1px 0 rgba(0,0,0,0.15)}
      50%{box-shadow:0 2px 8px ${T.accent}55,0 8px 28px ${T.accent}60,0 0 0 6px ${T.accent}18,inset 0 1px 0 rgba(255,255,255,0.45),inset 0 -1px 0 rgba(0,0,0,0.15)}
    }
    @keyframes priorityBreathe{
      0%,100%{box-shadow:0 0 0 0 ${T.accent}40,0 0 14px ${T.accent}55}
      50%{box-shadow:0 0 0 6px ${T.accent}00,0 0 22px ${T.accent}88}
    }
    ::-webkit-scrollbar-thumb{background:${T.border};border-radius:4px}
  `, [T.accent, T.border]);

  if (!user) return <LoginScreen onLogin={login} />;

  /* ── Sidebar helpers ── */
  const GOAL        = 48_000_000;
  const activeLeads = leadsData.filter(l => l.presupuesto > 0);
  const totalPipe   = activeLeads.reduce((s, l) => s + (l.presupuesto || 0), 0);
  const pc          = Math.min(100, Math.round((totalPipe / GOAL) * 100));
  const avgScore    = activeLeads.length
    ? Math.round(activeLeads.reduce((s, l) => s + (l.sc || 0), 0) / activeLeads.length) : 0;
  const fmt = n => n >= 1e6 ? `$${(n/1e6).toFixed(1).replace(/\.0$/,"")}M` : `$${(n/1e3).toFixed(0)}K`;

  const primary   = nav.filter(n => !n.more);
  const secondary = nav.filter(n => n.more && (!n.adminOnly || ["super_admin","admin"].includes(user?.role)));
  const hasActiveMore = secondary.some(n => n.id === v);

  const NavBtn = ({ n }) => {
    const a = v === n.id;
    const isAdmin = n.adminOnly;
    const hasAccess = MODULE_ROLES[n.id]?.includes(user?.role) ?? true;
    const mintC = isAdmin ? "#A78BFA" : "#6EE7C2";
    const activeColor = isAdmin ? "#A78BFA" : (isLight ? T.accent : mintC);
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, width:"100%", padding:"0 8px" }}>
        <button
          onClick={() => { setV(n.id); if (n.more) setSidebarMore(true); }}
          title={n.l + (!hasAccess ? " · Sin acceso" : "")}
          style={{
            width:48, height:40, borderRadius:12,
            cursor: hasAccess ? "pointer" : "not-allowed",
            opacity: hasAccess ? 1 : 0.32,
            border:"none", outline:"none",
            background: a ? (isLight ? `${T.accent}18` : "rgba(110,231,194,0.11)") : "transparent",
            display:"flex", alignItems:"center", justifyContent:"center",
            transition:"background 0.18s ease, transform 0.15s ease",
            position:"relative",
          }}
          onMouseEnter={e => { if (!a && hasAccess) { e.currentTarget.style.background = isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "scale(1.04)"; } }}
          onMouseLeave={e => { if (!a) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = "scale(1)"; } }}
          onMouseDown={e => { if (hasAccess) e.currentTarget.style.transform = "scale(0.94)"; }}
          onMouseUp={e => { if (hasAccess && !a) e.currentTarget.style.transform = "scale(1.04)"; }}
        >
          {a && (
            <div style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)", width:3, height:20, borderRadius:"0 3px 3px 0",
              background: isAdmin ? "#A78BFA" : "#6EE7C2",
              boxShadow: isAdmin ? "0 0 8px rgba(167,139,250,0.60)" : "0 0 8px rgba(110,231,194,0.55)",
            }} />
          )}
          <n.i size={20} color={a ? activeColor : (isLight ? "rgba(15,23,42,0.45)" : "rgba(255,255,255,0.32)")} strokeWidth={a ? 1.8 : 1.5} />
        </button>
        <span style={{ fontSize:7, fontFamily:fontDisp, fontWeight: a ? 600 : 400, letterSpacing: a ? "0.01em" : "0.005em", textAlign:"center",
          color: a ? activeColor : (isLight ? "rgba(15,23,42,0.38)" : "rgba(255,255,255,0.22)"),
          lineHeight:1, userSelect:"none", transition:"color 0.18s ease",
        }}>{n.l}</span>
      </div>
    );
  };

  /* ─────────────────── render ─────────────────── */
  return (
    <div className="stratos-app" style={{
      height:"100vh", display:"flex", fontFamily:font, color:T.txt,
      background: isLight
        ? `radial-gradient(1400px 900px at 50% -10%, rgba(13,154,118,0.10) 0%, rgba(13,154,118,0.04) 35%, transparent 65%),
           radial-gradient(1200px 800px at 50% 110%, rgba(20,184,146,0.08) 0%, rgba(20,184,146,0.03) 35%, transparent 65%),
           linear-gradient(180deg, #F4F9F6 0%, #F8FBF9 45%, #F4F9F6 100%)`
        : `radial-gradient(1200px 600px at 30% -5%, rgba(80,120,255,0.025) 0%, transparent 55%), #030810`,
      transition:"background 0.3s ease, color 0.3s ease",
    }}>
      {/* ── Static CSS ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .topbar-shimmer{background-size:300% 100%;animation:shimmer 2.4s linear infinite}
        .topbar-static{background-size:100%}
        .widget-shimmer{animation:pillShimmer 5s ease-in-out infinite}
        @keyframes blink{0%,100%{opacity:.25}50%{opacity:1}}
        @keyframes wave{from{transform:scaleY(.25)}to{transform:scaleY(1)}}
        @keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes atomSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes scanLine{0%{top:0}100%{top:100%}}
        @keyframes stepFade{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
        @keyframes modalIn{from{opacity:0;transform:translate(-50%,-50%) scale(0.97)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
        @keyframes pillBeamOnce{from{transform:translateX(-130%);opacity:0}22%{opacity:1}78%{opacity:1}to{transform:translateX(230%);opacity:0}}
        @keyframes iaosSlideIn{from{opacity:0;transform:translateX(-14px)}to{opacity:1;transform:translateX(0)}}
        *{box-sizing:border-box;margin:0}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:transparent}
        .stratos-bottomnav{display:none}
        @media(max-width:768px){
          .stratos-sidebar{display:none!important}
          .stratos-content-area{padding:14px 14px 72px 14px!important}
          .stratos-bottomnav{
            display:flex!important;position:fixed;bottom:0;left:0;right:0;
            height:58px;z-index:200;align-items:center;justify-content:space-around;
            border-top:1px solid rgba(255,255,255,0.07);
          }
        }
      `}</style>
      <style>{dynamicStyles}</style>

      {/* ══ BANNER MODO OFFLINE — solo para roles administrativos ══
            Asesores no ven nada: el modo offline + auto-sync es totalmente
            transparente para ellos. */}
      {showOfflineBanner && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 999,
          background: "linear-gradient(90deg, #F59E0B 0%, #EAB308 100%)",
          color: "#0B1220",
          padding: "8px 16px",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
          fontSize: 12.5, fontWeight: 600, fontFamily: font,
          boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#0B1220", animation: "pulse 1.6s ease-in-out infinite" }} />
            {user?._offline
              ? "Modo offline — servicio respondiendo lento. Cambios se sincronizan automáticamente al recuperar conexión."
              : "Sincronización pendiente — los cambios se enviarán automáticamente."}
          </span>
          {pendingSync > 0 && (
            <span style={{
              padding: "2px 9px", borderRadius: 99, background: "#0B1220",
              color: "#F59E0B", fontSize: 11, fontWeight: 700,
            }}>
              {pendingSync} cambio{pendingSync !== 1 ? "s" : ""} pendiente{pendingSync !== 1 ? "s" : ""}
            </span>
          )}
          <button
            onClick={handleSync}
            disabled={syncing || pendingSync === 0}
            style={{
              padding: "5px 12px", borderRadius: 7,
              background: pendingSync > 0 && !syncing ? "#0B1220" : "rgba(11,18,32,0.30)",
              color: "#FFFFFF", border: "none",
              fontSize: 11, fontWeight: 700, fontFamily: font,
              cursor: syncing || pendingSync === 0 ? "not-allowed" : "pointer",
              transition: "all 0.18s",
            }}
          >
            {syncing ? "Sincronizando..." : "🔄 Sincronizar ahora"}
          </button>
          {syncMsg && (
            <span style={{ fontSize: 11, fontWeight: 600 }}>{syncMsg}</span>
          )}
        </div>
      )}

      {/* ══ SIDEBAR ══ */}
      <div className="stratos-sidebar" style={{
        width:72, flexShrink:0, zIndex:10,
        borderRight:`1px solid ${isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.05)"}`,
        display:"flex", flexDirection:"column", alignItems:"center",
        paddingTop:0, paddingBottom:0, position:"relative", overflow:"hidden",
        background: isLight ? "rgba(246,248,247,0.98)" : "rgba(2,4,11,0.98)",
        backdropFilter:"blur(28px)", WebkitBackdropFilter:"blur(28px)",
        transition:"background 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease",
        boxShadow: isLight ? "1px 0 0 rgba(0,0,0,0.05)" : "1px 0 0 rgba(255,255,255,0.04), 8px 0 28px rgba(0,0,0,0.30)",
      }}>
        {/* TOP: Atom identity */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", paddingTop:11, paddingBottom:10, flexShrink:0, gap:6 }}>
          <div style={{ animation:"atomSpin 16s linear infinite",
            filter: isLight ? "drop-shadow(0 0 5px rgba(13,154,118,0.45)) drop-shadow(0 0 12px rgba(52,211,153,0.18))" : "drop-shadow(0 0 4px rgba(255,255,255,0.40)) drop-shadow(0 0 10px rgba(255,255,255,0.10))",
          }}>
            <StratosAtomHex size={30} color={isLight ? "#0D9A76" : "#FFFFFF"} edge={isLight ? "#34D399" : "#C8DED8"} />
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
            <div style={{ width:4, height:4, borderRadius:"50%", background:"#34D399", boxShadow:"0 0 5px rgba(52,211,153,0.80), 0 0 10px rgba(52,211,153,0.30)", animation:"pulse 2.2s ease-in-out infinite" }} />
            <span style={{ fontSize:7, fontFamily:fontDisp, fontWeight:700, letterSpacing:"0.18em", textTransform:"uppercase", color: isLight ? "rgba(15,23,42,0.32)" : "rgba(255,255,255,0.28)", lineHeight:1 }}>Live</span>
          </div>
          <div style={{ width:28, height:1, background: isLight ? "linear-gradient(90deg, transparent, rgba(13,154,118,0.18), transparent)" : "linear-gradient(90deg, transparent, rgba(110,231,194,0.12), transparent)" }} />
        </div>

        {/* Nav items */}
        <div style={{ flex:1, width:"100%", overflowY:"auto", overflowX:"hidden", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", paddingBottom:4, gap:6 }}>
          {/* Live Plan metrics widget */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", paddingBottom:10, width:"100%" }}>
            <div onClick={() => setMetaOpen(true)} style={{
              position:"relative", width:"calc(100% - 14px)", borderRadius:19, overflow:"hidden", cursor:"pointer",
              background: isLight ? "rgba(255,255,255,0.62)" : "linear-gradient(155deg, #0D1E18 0%, #080F10 55%, #040810 100%)",
              backdropFilter: isLight ? "blur(32px) saturate(180%)" : "none",
              WebkitBackdropFilter: isLight ? "blur(32px) saturate(180%)" : "none",
              border: isLight ? "1px solid rgba(255,255,255,0.92)" : "1px solid rgba(52,211,153,0.22)",
              boxShadow: isLight
                ? "inset 0 1.5px 0 rgba(255,255,255,1), 0 6px 28px rgba(13,154,118,0.10)"
                : ["inset 0 1px 0 rgba(52,211,153,0.38)","inset 0 -1px 0 rgba(0,0,0,0.40)","inset 1px 0 0 rgba(52,211,153,0.10)","inset -1px 0 0 rgba(52,211,153,0.10)","0 0 0 1px rgba(52,211,153,0.06)","0 0 28px rgba(52,211,153,0.10)","0 16px 48px rgba(0,0,0,0.70)"].join(", "),
              padding:"11px 9px 12px",
            }}>
              <div style={{ position:"absolute", top:0, left:0, right:0, height:"45%", background: isLight ? "linear-gradient(180deg, rgba(255,255,255,0.65) 0%, transparent 100%)" : "linear-gradient(180deg, rgba(52,211,153,0.07) 0%, transparent 100%)", pointerEvents:"none", borderRadius:"20px 20px 0 0" }} />
              {isLight && <div className="widget-shimmer" style={{ position:"absolute", top:0, bottom:0, left:0, width:"60%", background:"linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.07) 50%, transparent 100%)", pointerEvents:"none" }} />}
              <div style={{ position:"absolute", bottom:-6, left:"50%", transform:"translateX(-50%)", width:72, height:40, background: isLight ? "radial-gradient(ellipse, rgba(13,154,118,0.18) 0%, transparent 70%)" : "radial-gradient(ellipse, rgba(52,211,153,0.22) 0%, transparent 70%)", filter:"blur(12px)", pointerEvents:"none" }} />
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", position:"relative", zIndex:1, marginBottom:8 }}>
                <span style={{ fontSize:7.5, fontFamily:fontDisp, fontWeight:500, letterSpacing:"-0.01em", color: isLight ? "rgba(15,23,42,0.46)" : "rgba(255,255,255,0.38)" }}>{fmt(totalPipe)}</span>
                <span style={{ fontSize:7.5, fontFamily:fontDisp, fontWeight:600, letterSpacing:"-0.01em", color: isLight ? "rgba(13,154,118,0.82)" : "rgba(52,211,153,0.72)" }}>{avgScore}</span>
              </div>
              <span style={{ fontSize:33, fontWeight:200, fontFamily:fontDisp, letterSpacing:"-0.04em", lineHeight:1, color: isLight ? "#082818" : "#FFFFFF", display:"block", position:"relative", zIndex:1 }}>{pc}</span>
              <div style={{ width:"100%", height:2.5, borderRadius:99, background: isLight ? "rgba(13,154,118,0.09)" : "rgba(255,255,255,0.08)", marginTop:9, overflow:"hidden", position:"relative", zIndex:1 }}>
                <div style={{ width:`${pc}%`, height:"100%", borderRadius:99, background: isLight ? "linear-gradient(90deg, #0D9A76, #34D399)" : "linear-gradient(90deg, #34D399, #6EE7C2)", boxShadow: isLight ? "none" : "0 0 8px rgba(52,211,153,0.55)", transition:"width 1.1s cubic-bezier(0.4,0,0.2,1)" }} />
              </div>
              <span style={{ fontSize:5.5, fontWeight:700, fontFamily:fontDisp, letterSpacing:"0.17em", textTransform:"uppercase", color: isLight ? "rgba(13,154,118,0.48)" : "rgba(52,211,153,0.36)", display:"block", marginTop:8, position:"relative", zIndex:1 }}>META</span>
            </div>
            <div style={{ width:32, height:1, marginTop:10, background: isLight ? "linear-gradient(90deg, transparent, rgba(15,23,42,0.07), transparent)" : "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }} />
          </div>

          {primary.map(n => <NavBtn key={n.id} n={n} />)}

          {/* More toggle */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, marginTop:4, width:"100%", padding:"0 8px" }}>
            <div style={{ height:1, width:32, background: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.05)" }} />
            <button onClick={() => setSidebarMore(s => !s)} title={sidebarMore ? "Ocultar" : "Más"}
              style={{ width:48, height:30, borderRadius:10, border:"none", background:(sidebarMore || hasActiveMore) ? (isLight ? `${T.accent}14` : "rgba(110,231,194,0.09)") : "transparent", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:4, transition:"background 0.18s ease" }}
              onMouseEnter={e => { e.currentTarget.style.background = isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = (sidebarMore || hasActiveMore) ? (isLight ? `${T.accent}14` : "rgba(110,231,194,0.09)") : "transparent"; }}
            >
              <ChevronDown size={13} color={(sidebarMore || hasActiveMore) ? (isLight ? T.accent : "#6EE7C2") : (isLight ? "rgba(15,23,42,0.30)" : "rgba(255,255,255,0.25)")} strokeWidth={1.8} style={{ transform: sidebarMore ? "rotate(180deg)" : "rotate(0deg)", transition:"transform 0.26s cubic-bezier(0.34,1.56,0.64,1)" }} />
            </button>
            <span style={{ fontSize:7, fontFamily:fontDisp, fontWeight:400, letterSpacing:"0.01em", userSelect:"none", color:(sidebarMore || hasActiveMore) ? (isLight ? T.accent : "#6EE7C2") : (isLight ? "rgba(15,23,42,0.28)" : "rgba(255,255,255,0.20)"), transition:"color 0.18s ease" }}>
              {sidebarMore ? "Menos" : "Más"}
            </span>
          </div>

          <div style={{ width:"100%", overflow:"hidden", maxHeight: sidebarMore ? `${secondary.length * 66}px` : "0px", opacity: sidebarMore ? 1 : 0, transition:"max-height 0.38s cubic-bezier(0.4,0,0.2,1), opacity 0.26s ease", display:"flex", flexDirection:"column", alignItems:"center" }}>
            <div style={{ height:1, width:34, background: isLight ? "rgba(13,154,118,0.08)" : "rgba(255,255,255,0.05)", margin:"4px 0 4px" }} />
            {secondary.map(n => <NavBtn key={n.id} n={n} />)}
          </div>
        </div>

        {/* Bottom: System button */}
        <div style={{ width:"100%", display:"flex", flexDirection:"column", alignItems:"center", paddingBottom:12 }}>
          <div style={{ height:1, width:34, background: isLight ? "rgba(13,154,118,0.10)" : "rgba(255,255,255,0.06)", margin:"4px auto 8px" }} />
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
            <button title={["super_admin","admin"].includes(user?.role) ? "Gestión de Usuarios" : "Configuración"}
              onClick={() => ["super_admin","admin"].includes(user?.role) ? setV("admin") : null}
              style={{
                width:44, height:44, borderRadius:13, cursor:"pointer",
                background: v==="admin" ? "rgba(167,139,250,0.14)" : (isLight ? "rgba(255,255,255,0.62)" : "rgba(255,255,255,0.038)"),
                border: v==="admin" ? "1px solid rgba(167,139,250,0.28)" : `1px solid ${isLight ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.06)"}`,
                backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)",
                display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow: isLight ? "inset 0 1px 0 rgba(255,255,255,0.72), 0 1px 2px rgba(15,23,42,0.04)" : "inset 0 1px 0 rgba(255,255,255,0.05)",
                transition:"all 0.22s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = isLight ? `${T.accent}10` : "rgba(255,255,255,0.08)"; e.currentTarget.style.transform="scale(1.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = v==="admin" ? "rgba(167,139,250,0.14)" : (isLight ? "rgba(255,255,255,0.62)" : "rgba(255,255,255,0.038)"); e.currentTarget.style.transform="scale(1)"; }}
            >
              <Settings size={17} color={v==="admin" ? "#A78BFA" : (isLight ? T.txt2 : "rgba(255,255,255,0.34)")} strokeWidth={1.9} />
            </button>
            <span style={{ fontSize:7.5, fontFamily:font, fontWeight:500, color: isLight ? T.txt3 : "rgba(255,255,255,0.22)", userSelect:"none" }}>System</span>
          </div>
        </div>
      </div>

      {/* ══ MAIN ══ */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
        {/* HEADER */}
        {(() => {
          const hBg = isLight ? "linear-gradient(180deg,#FFFFFF 0%,rgba(248,253,250,0.96) 100%)" : "#02050E";
          const hBorder = isLight ? "rgba(13,154,118,0.10)" : "rgba(255,255,255,0.06)";
          const iBtnBase = { width:32, height:32, borderRadius:8, border:"none", background:"transparent", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.14s ease" };
          const iBtnHoverBg  = isLight ? `${T.accent}0D` : "rgba(255,255,255,0.07)";
          const iBtnActiveBg = isLight ? `${T.accent}18` : "rgba(255,255,255,0.12)";
          const icoRest  = isLight ? T.txt3  : "rgba(255,255,255,0.40)";
          const hDiv = <div style={{ width:1, height:16, flexShrink:0, background: isLight ? `${T.accent}22` : "rgba(255,255,255,0.07)", margin:"0 2px" }} />;
          const onIco  = e => { e.currentTarget.style.background = iBtnHoverBg; };
          const offIco = e => { e.currentTarget.style.background = "transparent"; };
          const dnIco  = e => { e.currentTarget.style.background = iBtnActiveBg; e.currentTarget.style.transform="scale(0.92)"; };
          const upIco  = e => { e.currentTarget.style.background = iBtnHoverBg;  e.currentTarget.style.transform="scale(1)"; };
          return (
            <div style={{ position:"relative", flexShrink:0, padding:"0 20px", height:52, borderBottom:`1px solid ${hBorder}`, display:"flex", justifyContent:"space-between", alignItems:"center", background:hBg, backdropFilter: isLight ? "blur(24px) saturate(180%)" : "none", WebkitBackdropFilter: isLight ? "blur(24px) saturate(180%)" : "none", boxShadow: isLight ? "inset 0 -1px 0 rgba(13,154,118,0.08), 0 2px 16px rgba(15,23,42,0.04)" : "none", transition:"background 0.3s ease" }}>
              {/* LEFT */}
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <p style={{ margin:0, fontSize:14, fontFamily:fontDisp, letterSpacing:"-0.030em", fontWeight:600, color: isLight ? T.txt : "#FFFFFF", lineHeight:1, whiteSpace:"nowrap" }}>
                  Stratos<span style={{ marginLeft:3, fontWeight:600, color: isLight ? "rgba(15,23,42,0.38)" : "rgba(255,255,255,0.30)", letterSpacing:"0.01em" }}>IA</span>
                </p>
                <IAOSIsland leadsData={leadsData} isLight={isLight} idx={iaosIdx} />
              </div>
              {/* CENTER */}
              <div style={{ position:"absolute", left:"50%", transform:"translateX(-50%)" }}>
                <DynIsland onExpand={openPriorityLead} notifications={notifs} theme={theme} beamIdx={iaosIdx} />
              </div>
              {/* RIGHT */}
              <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                <button title="Buscar (⌘K)" style={iBtnBase} onMouseEnter={onIco} onMouseLeave={offIco} onMouseDown={dnIco} onMouseUp={upIco}>
                  <Search size={14} color={icoRest} strokeWidth={2} />
                </button>
                <button title="Notificaciones" style={{ ...iBtnBase, position:"relative" }} onMouseEnter={onIco} onMouseLeave={offIco} onMouseDown={dnIco} onMouseUp={upIco}>
                  <Bell size={14} color={icoRest} strokeWidth={2} />
                  <div style={{ position:"absolute", top:6, right:6, width:5, height:5, borderRadius:"50%", background:T.rose, border:`1.5px solid ${isLight ? "#F5FAF8" : "#050507"}` }} />
                </button>
                {hDiv}
                <button onClick={() => setTheme(isLight ? "dark" : "light")} title={isLight ? "Modo oscuro" : "Modo claro"}
                  style={{ width:42, height:24, borderRadius:12, border:"none", padding:0, flexShrink:0, background: isLight ? `linear-gradient(135deg, ${T.accent} 0%, #12B48A 100%)` : "rgba(255,255,255,0.09)", cursor:"pointer", position:"relative", transition:"background 0.28s ease", boxShadow: isLight ? `0 2px 8px ${T.accent}40, inset 0 1px 0 rgba(255,255,255,0.28)` : "inset 0 1px 3px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.08)" }}>
                  <div style={{ position:"absolute", top:3, left: isLight ? 21 : 3, width:18, height:18, borderRadius:"50%", background:"#FFFFFF", boxShadow:"0 1px 4px rgba(0,0,0,0.22), 0 2px 6px rgba(0,0,0,0.12)", transition:"left 0.28s cubic-bezier(0.34,1.56,0.64,1)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {isLight ? <Sun size={9} color={T.accent} strokeWidth={2.4} /> : <Moon size={8} color="#64748B" strokeWidth={2} fill="#64748B" />}
                  </div>
                </button>
                {hDiv}
                <div style={{ display:"flex", alignItems:"center", gap:8, padding:"0 8px 0 3px", height:32, borderRadius:8, cursor:"default", transition:"background 0.14s", flexShrink:0 }}
                  onMouseEnter={e => { e.currentTarget.style.background = iBtnHoverBg; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ width:26, height:26, borderRadius:"50%", flexShrink:0, background: isLight ? `linear-gradient(135deg, ${T.accent} 0%, #10B48A 100%)` : `linear-gradient(145deg, rgba(110,231,194,0.28) 0%, rgba(52,211,153,0.12) 100%)`, border: isLight ? "1.5px solid rgba(255,255,255,0.30)" : `1.5px solid rgba(110,231,194,0.24)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10.5, fontWeight:800, fontFamily:fontDisp, color: isLight ? "#FFFFFF" : T.accent, boxShadow: isLight ? `0 2px 8px ${T.accent}45` : `inset 0 1px 0 rgba(110,231,194,0.22)` }}>
                    {user?.name?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <div style={{ display:"flex", flexDirection:"column" }}>
                    <span style={{ fontSize:11.5, fontWeight:700, fontFamily:fontDisp, letterSpacing:"-0.01em", lineHeight:1.2, color: isLight ? T.txt : "rgba(255,255,255,0.82)", whiteSpace:"nowrap" }}>
                      {user?.name?.split(" ")[0] || "Usuario"}
                    </span>
                    <span style={{ fontSize:9, fontWeight:600, fontFamily:font, letterSpacing:"0.02em", lineHeight:1.1, color: user?.isDemo ? T.amber : (isLight ? T.txt3 : "rgba(255,255,255,0.30)"), whiteSpace:"nowrap" }}>
                      {user?.isDemo ? "Demo" : (user?.role || "Miembro")}
                    </span>
                  </div>
                </div>
                {hDiv}
                <button onClick={onLogout} title="Cerrar sesión" style={iBtnBase}
                  onMouseEnter={e => { e.currentTarget.style.background = isLight ? "rgba(225,29,72,0.07)" : "rgba(239,68,68,0.10)"; }}
                  onMouseLeave={offIco}
                  onMouseDown={e => { e.currentTarget.style.background = isLight ? "rgba(225,29,72,0.13)" : "rgba(239,68,68,0.18)"; }}
                  onMouseUp={e => { e.currentTarget.style.background = isLight ? "rgba(225,29,72,0.07)" : "rgba(239,68,68,0.10)"; }}
                >
                  <LogOut size={13} color={icoRest} strokeWidth={2.4} />
                </button>
              </div>
            </div>
          );
        })()}

        {/* CONTENT */}
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
          <div key={v} className="stratos-content-area" style={{ flex:1, padding:"18px 22px", overflowY:"auto", animation:"fadeIn 0.28s ease", display:"flex", flexDirection:"column" }}>
            {user?.role && MODULE_ROLES[v] && !MODULE_ROLES[v].includes(user.role)
              ? <PermissionGate moduleId={v} onGoBack={() => setV("c")} />
              : <Suspense fallback={
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"60px 20px", color:T.txt3, fontFamily:font, fontSize:13 }}>
                    <span style={{ display:"inline-block", width:20, height:20, border:`2px solid ${T.accent}40`, borderTopColor:T.accent, borderRadius:"50%", animation:"spin 0.8s linear infinite", marginRight:10 }} />
                    Cargando…
                  </div>
                }>
                  {v === "d"      && <Dash oc={oc} leadsData={leadsData} T={T} />}
                  {v === "c"      && <CRM oc={oc} leadsData={leadsData} setLeadsData={setLeadsData} theme={theme} setTheme={setTheme} autoOpenPriority1={autoOpenPriority1} onAutoOpenHandled={() => setAutoOpenPriority1(0)} />}
                  {v === "ia"     && <IACRM oc={oc} T={T} theme={theme} />}
                  {v === "e"      && <ERP oc={oc} T={T} />}
                  {v === "a"      && <Team oc={oc} T={T} />}
                  {v === "lp"     && <LandingPages T={T} />}
                  {v === "fa"     && <FinanzasAdmin T={T} />}
                  {v === "rrhh"   && <RRHHModule T={T} />}
                  {v === "planes" && <PricingScreen embedded onBack={() => setV(isAsesorRole ? "c" : "d")} />}
                  {v === "admin"  && ["super_admin","admin"].includes(user?.role) && <AdminPanel />}
                </Suspense>
            }
          </div>
          <Chat open={co} onClose={() => setCo(false)} msgs={msgs} setMsgs={setMsgs} inp={inp} setInp={setInp} />
        </div>
      </div>

      {/* ══ MOBILE BOTTOM NAV ══ */}
      <div className="stratos-bottomnav" style={{ backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)", background: isLight ? "rgba(246,248,247,0.97)" : "rgba(2,4,11,0.97)" }}>
        {nav.filter(n => !n.more).map(n => {
          const a = v === n.id;
          const activeColor = isLight ? T.accent : "#6EE7C2";
          return (
            <button key={n.id} onClick={() => setV(n.id)} style={{ flex:1, height:"100%", border:"none", background:"transparent", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3, outline:"none" }}>
              <n.i size={22} color={a ? activeColor : (isLight ? "rgba(15,23,42,0.38)" : "rgba(255,255,255,0.30)")} strokeWidth={a ? 1.9 : 1.5} />
              <span style={{ fontSize:9, fontFamily:fontDisp, fontWeight: a ? 700 : 400, color: a ? activeColor : (isLight ? "rgba(15,23,42,0.38)" : "rgba(255,255,255,0.28)"), lineHeight:1 }}>{n.l}</span>
            </button>
          );
        })}
        <button onClick={() => setSidebarMore(p => !p)} style={{ flex:1, height:"100%", border:"none", background:"transparent", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3, outline:"none" }}>
          <ChevronsDown size={22} color={nav.filter(n=>n.more).some(n=>n.id===v) ? (isLight ? T.accent : "#6EE7C2") : (isLight ? "rgba(15,23,42,0.38)" : "rgba(255,255,255,0.30)")} strokeWidth={1.5} style={{ transform: sidebarMore ? "rotate(180deg)" : "none", transition:"transform 0.22s" }} />
          <span style={{ fontSize:9, fontFamily:fontDisp, fontWeight:400, color: nav.filter(n=>n.more).some(n=>n.id===v) ? (isLight ? T.accent : "#6EE7C2") : (isLight ? "rgba(15,23,42,0.38)" : "rgba(255,255,255,0.28)"), lineHeight:1 }}>Más</span>
        </button>
        {sidebarMore && (
          <div style={{ position:"fixed", bottom:58, left:0, right:0, zIndex:199, display:"flex", flexWrap:"wrap", justifyContent:"center", gap:8, padding:"14px 16px", background: isLight ? "rgba(246,248,247,0.97)" : "rgba(4,8,18,0.97)", backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)", borderTop:`1px solid ${isLight ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.07)"}` }}>
            {nav.filter(n => n.more && (!n.adminOnly || ["super_admin","admin"].includes(user?.role))).map(n => {
              const a = v === n.id;
              const activeColor = n.adminOnly ? "#A78BFA" : (isLight ? T.accent : "#6EE7C2");
              return (
                <button key={n.id} onClick={() => { setV(n.id); setSidebarMore(false); }} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, padding:"10px 14px", borderRadius:14, border:"none", cursor:"pointer", background: a ? `${activeColor}14` : (isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.05)"), minWidth:70 }}>
                  <n.i size={20} color={a ? activeColor : (isLight ? "rgba(15,23,42,0.45)" : "rgba(255,255,255,0.35)")} strokeWidth={a ? 1.9 : 1.5} />
                  <span style={{ fontSize:9.5, fontFamily:fontDisp, fontWeight: a ? 700 : 400, color: a ? activeColor : (isLight ? "rgba(15,23,42,0.45)" : "rgba(255,255,255,0.35)"), lineHeight:1 }}>{n.l}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ══ META PANEL ══ */}
      <MetaPanel
        open={metaOpen}
        onClose={() => setMetaOpen(false)}
        metaTab={metaTab}
        setMetaTab={setMetaTab}
        metaActions={metaActions}
        setMetaActions={setMetaActions}
        metaNewText={metaNewText}
        setMetaNewText={setMetaNewText}
        doneCollapsed={doneCollapsed}
        setDoneCollapsed={setDoneCollapsed}
        metaPlan={metaPlan}
        setMetaPlan={setMetaPlan}
        metaProtocol={metaProtocol}
        setMetaProtocol={setMetaProtocol}
        leadsData={leadsData}
        T={T}
        isLight={isLight}
      />
    </div>
  );
}
