/**
 * app/App.jsx — Shell principal de Stratos AI
 * ─────────────────────────────────────────────────────────────────────────────
 * Únicamente contiene: estado global, Sidebar, Header, BottomNav, view routing.
 * Todos los componentes y lógica de negocio viven en sus propios módulos.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, lazy, Suspense } from "react";
import { createPortal, flushSync } from "react-dom";
import { supabase, SUPABASE_REST_URL, SUPABASE_ANON_KEY } from "../lib/supabase";
import { formatFechaLarga, STAGES_CON_CITA } from "../lib/utils";
import { startRing, stopRing, primeRinger } from "../lib/ringer";
import LoginScreen from "../landing/LoginScreen.jsx";

import { useAuth } from "../hooks/useAuth";
import { useClient } from "../hooks/useClient";
import { useWhatsAppInbox } from "../hooks/useWhatsAppInbox";
import { useCopilotInbox } from "../hooks/useCopilotInbox";
import {
  getOfflineLeads,
  updateOfflineLead,
  getPendingSyncCount,
  syncToSupabase,
  pingSupabase,
  silentSignIn,
  discardPendingSync,
} from "../lib/offline-mode";

/* Puente con la app nativa (Capacitor): notificaciones nativas y archivos.
   En navegador cada helper cae al comportamiento web de siempre. */
import { isNativeApp, ensureNotifPermission, notifyUser, addNotificationTapListener } from "../lib/native";

/* Push REAL de la app nativa (APNs): es el único que llega con la app CERRADA.
   notifyUser de arriba solo dispara con la app abierta, porque lo maneja React. */
import { iniciarPushNativo, detenerPushNativo } from "../lib/push-native";
import { prepararAvisos } from "../lib/avisos-nativos";
import { sincronizarRecordatorios, limpiarRecordatorios } from "../lib/recordatorios-locales";
import { engancharLlamadas, soltarLlamadas, llamadaEnCurso, marcarLlamadaDespachada } from "../lib/llamadas-nativas";

/* Sistema de notificaciones Web Push (PWA "Agregar a inicio" en iPhone/Android) */
import { initPushContext, enablePushNotifications, onNotificationClick, getPushStatus, subscribeToPush, saveSubscriptionToBackend } from "../lib/push";

import {
  Search, Bell, Settings, LogOut, Sun, Moon, ChevronDown, X, PhoneCall, PhoneOff, MessageCircle, Target, Sparkles, Bot,
} from "lucide-react";
import "./App.css";

/* ── Design system ── */
import { font, fontDisp } from "../design-system/tokens";

/* ── Feature components ── */
import { StratosAtomHex } from "./components/Logo";
import DynIsland          from "./components/DynIsland";
import IAOSIsland         from "./components/IAOSIsland";
import CopilotMark        from "./components/CopilotMark";
import { buildIntelNotifs } from "./constants/intelNotifs";
import { buildMktIntelNotifs, buildMktIntelPhrases } from "./constants/intelMkt";
import PermissionGate     from "./components/PermissionGate";
import { IosIcon }        from "./icons/ios-icons";
import Chat, { getResp }  from "./features/ChatPanel";
import MetaPanel,
  { DEFAULT_META_PLAN, DEFAULT_META_PROTOCOL } from "./features/MetaPanel";
// AdminPanel y vistas pesadas se cargan bajo demanda con React.lazy
// para reducir el bundle inicial de ~1.3 MB a ~400 KB.
const AdminPanel = lazy(() => import("./features/Admin/AdminPanel"));
const RailsSettings = lazy(() => import("./features/Admin/RailsSettings"));

/* ── Navigation & roles ── */
import { nav, MODULE_ROLES, MOBILE_PRIMARY_NAV, canAccessModule } from "./constants/navigation";

// Vistas que NO se persisten entre F5: son flujos efímeros (entrar a Planes
// desde una promo, abrir admin desde un settings click). El F5 te regresa
// a la vista de trabajo principal (CRM o Comando), no a estas pantallas.
// ⚠️ "miespacio" NO es una vista: es el PANEL superpuesto que abre `metaOpen`
// (ver el onClick del rail). No existe ninguna rama `v === "miespacio"` que lo
// dibuje. Si `v` llegaba a valer eso, el área de contenido quedaba VACÍA —
// pantalla negra, sin error de consola y sin mensaje— y como se persistía, el
// siguiente F5 volvía a dejarla en blanco: quedaba pegada para siempre.
// Reproducido el 17-ago en la cuenta de marketing de Duke: 28 segundos de
// espera y cero elementos dibujados. Entrando desde Apps con la sesión ya viva
// abría bien, porque ese camino usa el panel y no la vista.
// Al estar acá, además, se CURA sola la gente que ya la tenga guardada.
const NON_PERSISTABLE_VIEWS = new Set(["planes", "admin", "miespacio"]);

// Llave de ESTRENO de una sección nueva.
// El problema que resuelve: la vista guardada en localStorage GANA sobre el
// fallback (así quien ya usó la app vuelve donde estaba, que es lo correcto en
// el día a día). Pero eso hace que una sección NUEVA no se le muestre NUNCA a
// quien ya tenía una vista guardada — le pasó a Alex con Actividades el 28-jul:
// la sección existía y su navegador lo seguía mandando a la vista vieja, así que
// para él "no estaba".
// Con esta llave, la PRIMERA vez que entra después del cambio se le abre la
// sección nueva; de ahí en adelante manda su elección, como siempre.
const MKT_ESTRENO_KEY = "stratos.mkt.estreno.actividades";

// Tope del caché de leads en localStorage (paint instantáneo en F5).
// CRÍTICO: este caché comparte la cuota de localStorage (~5 MB en Safari) con
// el token de sesión de Supabase (sb-<ref>-auth-token). Los admins ven TODOS
// los leads de la org (RLS: is_admin_or_above/can_view_all_leads) — con 594
// leads el array completo pesa ~1.9 MB en localStorage (UTF-16) y, al crecer,
// llena la cuota; entonces el SDK no puede PERSISTIR el token refrescado
// (QuotaExceededError silencioso) → al siguiente F5 no hay sesión → "te saca
// de la nada". Cacheamos solo los N más recientes; el resto llega de Supabase
// en ~1 s (stale-while-revalidate). Así el caché queda acotado (~250 KB) y
// nunca desplaza al token. Los asesores no sufrían esto porque solo cachean
// sus propios leads (pocos).
const LEADS_CACHE_LIMIT = 150;

/**
 * Resuelve la vista inicial al montar la app:
 *   1. Si hay vista guardada para este usuario en localStorage Y su rol
 *      tiene permiso para verla Y no está en la lista efímera → la usamos.
 *   2. Si no, asesor → "c" (CRM), otros roles → "d" (Comando).
 */
function resolveInitialView(user, clientConfig) {
  // Clientes externos (no Stratos) siempre arrancan en CRM, independiente del rol.
  // Asesores Stratos también arrancan en CRM. El resto (admin/ceo/director Stratos) en Comando.
  const isAsesorRole = !["super_admin","admin","director","ceo"].includes(user?.role);
  const isExternalOrg = user?.organizationId && user.organizationId !== "00000000-0000-0000-0000-000000000001";
  // Marketing (equipo de Duke): NO tiene acceso al CRM — si cayera en "c" vería
  // la pantalla de "sin permiso". Su casa es el módulo Marketing (ERP de
  // actividades: Mi Día · Marcas · Pipeline · Solicitudes).
  // Marketing entra por ACTIVIDADES — el reporte del día. Para el equipo es donde
  // cuenta lo que hizo; para Alex, lo primero que necesita ver es qué hizo su
  // gente hoy. Pedido de Alex (llamada 27-jul): que aparezca al iniciar sesión,
  // sin buscarlo. Si tiene que buscarlo, no se usa.
  // `colaborador` (gente de área: Comercial, Operativo, Administrativo, Finanzas,
  // RRHH) entra por lo mismo y por la misma razón: su Plan de Trabajo Semanal es
  // lo primero que tiene que ver, no algo que haya que ir a buscar.
  // El `colaborador` abre en su PLAN SEMANAL — es la lista con la que arranca la
  // semana y la que el líder le revisa el viernes. Marketing sigue abriendo en
  // Actividades (pedido de Alex, 27-jul): su reporte del día es lo primero.
  // Tenant con el CRM APAGADO (features.crm: false — ej. Brasa y Piedra): su
  // casa es Actividades, jamás "c" (caería en «Acceso restringido» en bucle).
  const crmApagado = clientConfig?.features?.crm === false;
  const fallbackDeseado = user?.role === "colaborador"
    ? "plan"
    : ((user?.isMarketingAdmin || user?.role === "marketing" || crmApagado)
        ? "mkt_reporte"
        : ((isAsesorRole || isExternalOrg) ? "c" : "d"));
  // ⚠️ La vista inicial DEBE ser una que este usuario pueda abrir. En Brasa y
  // Gasil el admin caía en «Acceso restringido» EN BUCLE: el fallback decía
  // mkt_reporte, pero la regla anti-duplicado (módulo mkt renombrado
  // «Actividades») se lo esconde justamente a quien puede abrir el módulo
  // completo. La cadena prueba candidatos en orden y devuelve el primero
  // accesible — jamás una pantalla bloqueada (auditoría 12-ago).
  const resolverAccesible = (deseado) => {
    // ⛔ "miespacio" NO va acá: es un panel superpuesto, no una vista, y no hay
    // nada que lo dibuje. Si la cadena caía en él, el usuario arrancaba con la
    // pantalla vacía. El último recurso sigue siendo "perfil", que sí se dibuja.
    const candidatos = [deseado, "mkt", "c", "d", "copilot", "perfil"];
    for (const m of candidatos) {
      try { if (canAccessModule(m, user, clientConfig)) return m; } catch (_) { /* sigue */ }
    }
    return "perfil";
  };
  const fallback = resolverAccesible(fallbackDeseado);
  if (!user?.id) return fallback;
  // Estreno de Actividades: una sola vez por usuario de marketing, antes de
  // mirar la vista guardada (si no, nunca la vería).
  const esMarketing = user?.isMarketingAdmin === true || user?.role === "marketing";
  try {
    if (esMarketing && !localStorage.getItem(`${MKT_ESTRENO_KEY}.${user.id}`)) {
      localStorage.setItem(`${MKT_ESTRENO_KEY}.${user.id}`, "1");
      return resolverAccesible("mkt_reporte");
    }
  } catch (_) { /* sin localStorage, sigue el camino normal */ }
  try {
    const saved = localStorage.getItem(`stratos.crm.view.${user.id}`);
    if (!saved) return fallback;
    if (NON_PERSISTABLE_VIEWS.has(saved)) return fallback;
    if (!canAccessModule(saved, user, clientConfig)) return fallback;
    return saved;
  } catch (_) {
    return fallback;
  }
}

/* ── Views ──
 * Dash y CRM son las que se ven inmediatamente al entrar → carga eager.
 * El resto se carga bajo demanda al cambiar de pestaña (code splitting). */
import Dash          from "./views/Dash";
import ComandoDirectivo from "./views/ComandoDirectivo";
const ComandoOps    = lazy(() => import("./views/ComandoOps"));
// Lazy a propósito: en web quita ~60 KB del arranque, y en la app este módulo
// ni siquiera se compila (ver vite.config.js).
const PricingScreen  = lazy(() => import("../landing/PricingScreen.jsx"));
// Chat del equipo: lazy porque solo lo usan los tenants con features.teamChat.
const ChatEquipo    = lazy(() => import("./views/ChatEquipo"));
import CRM           from "./views/CRM";
import ErrorBoundary from "../components/ErrorBoundary.jsx";
const ERP           = lazy(() => import("./views/ERP"));
const Team          = lazy(() => import("./views/Team"));
const IACRM         = lazy(() => import("./views/IACRM"));
const LandingPages  = lazy(() => import("./views/LandingPages"));
const FinanzasAdmin = lazy(() => import("./views/FinanzasAdmin"));
const RRHHModule    = lazy(() => import("./views/RRHHModule"));
const Caja          = lazy(() => import("./views/Caja"));
const WhatsAppInbox = lazy(() => import("./views/WhatsApp"));
const Copilot       = lazy(() => import("./views/Copilot"));
const Profile       = lazy(() => import("./views/Profile"));
const Trash         = lazy(() => import("./views/Trash"));
const Marketing     = lazy(() => import("./views/Marketing"));
const MiDrive       = lazy(() => import("./views/MiDrive"));
const PlanSemanal   = lazy(() => import("./views/PlanSemanal"));

/* ── PREFETCH de vistas ──────────────────────────────────────────────────────
 * Mismos specifiers que los lazy() de arriba. import() dedupe por specifier, así
 * que "warmear" acá deja LISTO el MISMO chunk que usará el lazy(). Objetivo: que
 * navegar a Create/ERP/etc. NO dispare un import en vivo — porque tras un deploy
 * ese import pediría un chunk con hash viejo que Vercel ya no tiene ("Failed to
 * fetch dynamically imported module") → el ErrorBoundary raíz recargaba toda la
 * app → parpadeo de login. Precargando contra el bundle actual, el módulo ya
 * está en memoria y el clic es instantáneo y a prueba de deploys. */
const PREFETCH_VIEWS = [
  () => import("./views/ERP"),
  () => import("./views/Team"),
  () => import("./views/IACRM"),
  () => import("./views/LandingPages"),
  () => import("./views/FinanzasAdmin"),
  () => import("./views/RRHHModule"),
  () => import("./views/Caja"),
  () => import("./views/WhatsApp"),
  () => import("./views/Copilot"),
  () => import("./views/Profile"),
  () => import("./views/Trash"),
  () => import("./views/Marketing"),
  () => import("./features/Admin/AdminPanel"),
];

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
  // Canvas Apple neutro (ver design-system/tokens.js). Gris frío luminoso, sin
  // tinte verde: el lienzo queda limpio y las tarjetas blancas "flotan".
  bg: "#F1F3F6", bgSoft: "#F6F7F9", bgCool: "#EBEEF2",
  glass: "rgba(255,255,255,0.70)", glassH: "rgba(255,255,255,0.92)",
  glassStrong: "rgba(255,255,255,0.96)",
  glassMint: "rgba(236,251,246,0.75)",
  border: "rgba(15,23,42,0.07)", borderH: "rgba(15,23,42,0.14)",
  borderMint: "rgba(15,158,122,0.18)", surface: "#FFFFFF",
  accent: "#0D9A76", accentDark: "#067A5E",
  accentS: "rgba(13,154,118,0.08)", accentB: "rgba(13,154,118,0.28)",
  accentG: "linear-gradient(135deg, #0D9A76 0%, #14B892 50%, #34D4AA 100%)",
  blue: "#2563EB", violet: "#7C3AED", amber: "#D97706",
  rose: "#E11D48", emerald: "#059669", cyan: "#0891B2",
  txt: "#0B1220", txt2: "#3B4A61", txt3: "#5C6B82",
  shadow1: "0 1px 1.5px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)",
  shadow2: "0 1px 2px rgba(15,23,42,0.05), 0 4px 12px rgba(15,23,42,0.08), 0 18px 40px rgba(15,23,42,0.10)",
  shadow3: "0 2px 6px rgba(15,23,42,0.07), 0 12px 32px rgba(15,23,42,0.12), 0 32px 72px rgba(15,23,42,0.14)",
  shadowMint: "0 2px 8px rgba(13,154,118,0.12), 0 10px 30px rgba(13,154,118,0.10)",
  r: 16, rs: 10, rx: 6,
};

/**
 * fetchAllPaged — Trae TODAS las filas de una query de Supabase paginando.
 * PostgREST limita cada request a 1000 filas (Max Rows del proyecto), así que
 * un solo `.select()` trunca silenciosamente cuando hay más de 1000 registros
 * (p.ej. >1000 leads activos → "desaparecían" los más antiguos del CRM).
 *
 * `makeQuery()` debe devolver un query builder NUEVO (sin `.range`) con el
 * filtro/orden deseado en cada llamada — los builders de Supabase son de un solo
 * uso, así que hay que recrearlo por página. Este helper aplica el `.range`.
 * Para que la paginación sea estable, la query debe incluir un orden determinista
 * (ideal: un campo único como `id` de desempate).
 */
async function fetchAllPaged(makeQuery) {
  const PAGE = 1000;
  let all = [];
  let from = 0;
  // Tope de seguridad anti-loop (50 páginas = 50k filas) por si el backend
  // devolviera siempre PAGE filas; en la práctica corta en cuanto baja de PAGE.
  for (let guard = 0; guard < 50; guard++) {
    const { data, error } = await makeQuery().range(from, from + PAGE - 1);
    if (error) return { data: all, error };
    const batch = data || [];
    all = all.concat(batch);
    if (batch.length < PAGE) break; // última página
    from += PAGE;
  }
  return { data: all, error: null };
}

/* ════════════════════════════════════════
   MAIN APP
   ════════════════════════════════════════ */
export default function App() {
  const { user, login, logout, upgradeToOnline, bootHydrating } = useAuth();
  // Cliente activo (Duke, Grupo 28, etc.) según hostname/path. Usado como
  // fallback para orgBrand cuando la organización del user no tiene `brand`
  // explícitamente seteado en meta_config — así cada cliente ve su propia
  // marca sin depender de checks hardcoded.
  const { config: clientConfig } = useClient();
  const isAsesorRole     = !["super_admin","admin","director","ceo"].includes(user?.role);
  // Telefono de soporte del tenant para mostrar como atajo en el header.
  // Si el cliente no define support.phoneLabel ni support.whatsapp, el boton
  // no se renderiza (cero impacto visual para clientes sin numero).
  const supportPhoneLabel = clientConfig?.support?.phoneLabel || clientConfig?.support?.whatsapp || "";
  const supportPhoneHref  = supportPhoneLabel ? `tel:${String(supportPhoneLabel).replace(/[^\d+]/g, "")}` : "";
  // Vista activa persistida por usuario en localStorage. Si haces F5 estando
  // en el CRM, vuelves al CRM (no al Comando). Validamos contra los permisos
  // del rol actual por si cambió desde la última sesión.
  const [v, setV]        = useState(() => resolveInitialView(user, clientConfig));

  // ⚠️ EL useState DE ARRIBA CORRE ANTES DE SABER QUIÉN ENTRÓ. `<App/>` se monta
  // en el primer render de main.jsx, mientras AuthContext todavía está hidratando
  // la sesión: `user` es null, así que `resolveInitialView` cae siempre al mismo
  // lado (asesor ⇒ "c", el CRM) y ese valor queda congelado — el inicializador de
  // useState no se vuelve a ejecutar nunca.
  // Lo que causaba: Alex (admin de MARKETING) iniciaba sesión y lo primero que
  // veía era «Acceso restringido — no tienes permiso para el módulo CRM», con el
  // menú de marketing al lado. Su casa es Actividades (Espacio 1 y 2). A los
  // administradores de ventas les pasaba lo mismo en silencio: caían en el CRM
  // en vez de Comando y nadie lo reportó porque el CRM sí les abre.
  // Por eso la vista se RESUELVE DE NUEVO cuando ya se sabe el rol. Va en
  // useLayoutEffect (no useEffect) para que se corrija ANTES de pintar: si no,
  // se ve un parpadeo del módulo equivocado.
  const vistaResueltaParaRef = useRef(null);
  useLayoutEffect(() => {
    if (!user?.id) return;
    if (vistaResueltaParaRef.current !== user.id) {
      vistaResueltaParaRef.current = user.id;   // también cubre cambiar de cuenta
      setV(resolveInitialView(user, clientConfig));
      return;
    }
    // Red de seguridad 1: "miespacio" es un PANEL, no una vista — nadie la
    // dibuja. Si por lo que sea `v` termina ahí (una versión vieja guardada, un
    // camino nuevo), se va a una vista que sí se dibuja en vez de dejar la
    // pantalla vacía. ⛔ Acá NO se puede tocar `setMetaOpen`: se declara mucho
    // más abajo y referenciarlo sería el mismo TDZ que tumbó el Copilot.
    if (v === "miespacio") { setV(resolveInitialView(user, clientConfig)); return; }
    // Red de seguridad 2: si la vista actual deja de ser suya (le cambian el rol o
    // los permisos a mitad de sesión), se va a su casa en vez de quedarse
    // mirando la pantalla de «Acceso restringido».
    if (!canAccessModule(v, user, clientConfig)) setV(resolveInitialView(user, clientConfig));
  }, [user, clientConfig, v]);

  // Vista PREVIA a las vistas INMERSIVAS (Copilot / WhatsApp) — su flecha
  // "‹ volver" regresa acá. Se guarda la última vista que NO sea inmersiva.
  const prevViewRef = useRef(isAsesorRole ? "c" : "d");
  useEffect(() => { if (v !== "copilot" && v !== "wa") prevViewRef.current = v; }, [v]);
  const backToPrevView = useCallback(() => setV(prevViewRef.current || (isAsesorRole ? "c" : "d")), [isAsesorRole]);

  // Persistir vista cuando cambia para que el próximo F5 te deje donde estabas.
  // Skip vistas efímeras (planes/admin) — esas son flujos que no queremos
  // restaurar automáticamente.
  useEffect(() => {
    if (!user?.id) return;
    if (NON_PERSISTABLE_VIEWS.has(v)) return;
    // Nunca recordar una vista que la persona NO puede abrir: si se guarda, en el
    // próximo inicio de sesión la restauramos y la deja mirando «Acceso
    // restringido». Le pasaba a Alex: el "c" del arranque sin usuario le quedaba
    // grabado como su última vista.
    if (!canAccessModule(v, user, clientConfig)) return;
    try { localStorage.setItem(`stratos.crm.view.${user.id}`, v); } catch (_) { /* quota o bloqueado */ }
  }, [v, user, clientConfig]);

  // ── Buscador del header → enfoca el input de busqueda del CRM ──
  // Implementacion minima: navega al CRM (si no estamos ahi) y enfoca el
  // input que ya existe en /src/app/views/CRM/index.jsx (marcado con el
  // atributo data-stratos-search-input). Soporta el atajo Cmd+K / Ctrl+K
  // que ya estaba prometido en el tooltip "Buscar (⌘K)" pero antes no hacia
  // nada al click.
  const openHeaderSearch = useCallback(() => {
    // Sin CRM (features.crm: false, ej. Brasa) el buscador no tiene a dónde ir:
    // saltar a "c" dejaría a la persona en «Acceso restringido».
    if (clientConfig?.features?.crm === false) return;
    setV("c"); // "c" es el id del modulo CRM en navigation.js
    setTimeout(() => {
      const input = document.querySelector('input[data-stratos-search-input]');
      if (input) {
        try { input.focus(); input.select(); } catch (_) { /* noop */ }
      }
    }, 80);
  }, [clientConfig?.features?.crm]);

  useEffect(() => {
    const onHeaderSearchKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        const tag = (e.target?.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea" || e.target?.isContentEditable) {
          return; // No interceptamos si estas escribiendo en otro campo.
        }
        e.preventDefault();
        openHeaderSearch();
      }
    };
    window.addEventListener("keydown", onHeaderSearchKey);
    return () => window.removeEventListener("keydown", onHeaderSearchKey);
  }, [openHeaderSearch]);

  const [co, setCo]      = useState(false);
  const [autoOpenPriority1, setAutoOpenPriority1] = useState(0);
  const [sidebarMore, setSidebarMore] = useState(false);
  // Panel "+" del bottom-nav móvil (independiente del "Más" del sidebar desktop)
  const [plusOpen, setPlusOpen] = useState(false);
  // Botón "+" del bottom-nav: abre el form de NUEVO CLIENTE en el CRM desde
  // cualquier vista (contador que CRM/index.jsx escucha — pedido de Ángel:
  // el FAB que aparecía/desaparecía se eliminó).
  const [crmNewLeadTick, setCrmNewLeadTick] = useState(0);
  // Bottom-nav móvil: 4 slots primarios + "Más". Los primarios salen de
  // MOBILE_PRIMARY_NAV, pero si a este usuario le faltan (p.ej. WhatsApp está
  // gateado, o el asesor no ve Comando/ERP) se RELLENAN con los siguientes
  // módulos accesibles — así la barra nunca queda con 1-2 botones sueltos.
  const accessibleBarNav = nav.filter(n => !n.more && canAccessModule(n.id, user, clientConfig));
  const mobilePrimaryBar = [
    ...accessibleBarNav.filter(n => MOBILE_PRIMARY_NAV.includes(n.id)),
    ...accessibleBarNav.filter(n => !MOBILE_PRIMARY_NAV.includes(n.id)),
  ].slice(0, 3);
  // Cuadro "+" (todas las opciones): TODOS los módulos accesibles — también
  // los 4 de la barra, así el cuadro es el mapa completo de la app.
  const mobileAllNav = nav.filter(n =>
    (!n.adminOnly || ["super_admin", "admin"].includes(user?.role)) &&
    canAccessModule(n.id, user, clientConfig)
  );
  const [msgs, setMsgs]  = useState([]);
  const [inp, setInp]    = useState("");
  const [notifs, setNotifs] = useState([]);
  // Centro de Inteligencia de MARKETING (Alex y su equipo no tienen leads:
  // ven sus tareas vencidas, videos parados y quién no reportó bitácora).
  const [mktIntel, setMktIntel] = useState(null);
  // Dropdown de la campana — abierto/cerrado
  const [bellOpen, setBellOpen] = useState(false);
  // Centro de Inteligencia desde el "+" del bottom-nav móvil: contador que
  // DynIsland escucha vía prop openSignal (la pill del header está oculta ahí).
  const [intelOpenTick, setIntelOpenTick] = useState(0);
  const bellRef = useRef(null);

  // ── Llamadas del equipo (tenants con features.reunionButton, hoy NSG) ──────
  // callOpen = selector "¿a quién llamo?" (persona puntual o grupal).
  // incomingCall = pantalla de LLAMADA ENTRANTE (overlay estilo WhatsApp) que
  // aparece cuando OTRO compañero me llama — llega por Realtime sobre
  // proactive_reminders (tipo 'llamada_entrante' con asesor_id = yo).
  const [callOpen, setCallOpen] = useState(false);
  const [callTargets, setCallTargets] = useState(null); // [{id,name}] compañeros de la org
  const [incomingCall, setIncomingCall] = useState(null); // {caller, meet}
  const openCallMenu = () => {
    setCallOpen(o => !o);
    if (callTargets === null) {
      supabase.rpc("fn_call_targets")
        .then(({ data }) => setCallTargets(Array.isArray(data) ? data : []))
        .catch(() => setCallTargets([]));
    }
  };
  const startTeamCall = (targetId) => {
    setCallOpen(false);
    // ⚠️ ORDEN CRÍTICO PARA CELULAR (bug real 24-jul): al abrir el Meet, la PWA
    // se va a background y iOS MATA los fetch normales en vuelo → el aviso "te
    // está llamando" y el disparo del bot grabador nunca salían del teléfono
    // (y el .catch lo tragaba en silencio). Fix: disparar PRIMERO la RPC con
    // fetch keepalive (sobrevive al cambio de app; token leído síncrono del
    // storage — getSession() es async y rompería el gesto del popup).
    let fired = false;
    try {
      const raw = localStorage.getItem("sb-glulgyhkrqpykxmujodb-auth-token");
      const parsed = raw ? JSON.parse(raw) : null;
      const tok = parsed?.access_token || parsed?.currentSession?.access_token || null;
      if (tok) {
        fetch(`${SUPABASE_REST_URL}/rest/v1/rpc/fn_start_team_call`, {
          method: "POST",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${tok}`,
          },
          body: JSON.stringify({ p_target_profile_id: targetId || null }),
        }).catch(() => {});
        fired = true;
      }
    } catch { /* cae al camino SDK */ }
    if (!fired) {
      supabase.rpc("fn_start_team_call", { p_target_profile_id: targetId || null }).catch(() => {});
    }
    // Abrir el Meet en el MISMO tick del gesto (popup blocker safe).
    window.open("https://meet.google.com/mus-xsur-jdc", "_blank", "noopener");
  };
  // Muestra la pantalla de llamada. Ignora avisos repetidos mientras ya hay una
  // en curso: si no, cada evento reiniciaría el timbre desde cero.
  const showIncomingCall = useCallback((caller, meet, id) => {
    setIncomingCall(prev => prev || {
      caller: caller || "Alguien",
      meet: meet || "https://meet.google.com/mus-xsur-jdc",
      // Se guarda para poder marcarla como resuelta al colgar o contestar. Sin
      // esto, colgar no sirve: el CRM la vuelve a encontrar al volver a la app.
      id: id || null,
    });
    try { if (navigator.vibrate) navigator.vibrate([300, 120, 300, 120, 300]); } catch { /* noop */ }
  }, []);
  // Cierra la notificación del SO al contestar/rechazar/expirar: viaja con
  // requireInteraction, así que sin esto se queda pegada en pantalla.
  const closeCallNotifications = useCallback(() => {
    try {
      navigator.serviceWorker?.ready
        ?.then(r => r.getNotifications({ tag: "stratos-llamada" }))
        .then(ns => ns.forEach(n => n.close()))
        .catch(() => { /* noop */ });
    } catch { /* noop */ }
  }, []);
  // Suscripción a llamadas entrantes (solo tenants con el botón; cleanup SIEMPRE).
  // ⚠️ HOY ESTE CAMINO NO DISPARA: `proactive_reminders` no está en la publicación
  // `supabase_realtime`, así que el INSERT nunca llega al navegador. Se deja
  // porque es el camino correcto y funciona solo si algún día se publica la
  // tabla; el que hace sonar el timbre es el efecto de abajo (push → SW).
  // NO publicar la tabla sin leer el comentario de public/sw.js: Duke inserta
  // ~1.4k filas/día y useCopilotInbox la escucha con event:'*' sin filtro.
  useEffect(() => {
    if (!user?.id || clientConfig?.features?.reunionButton !== true) return;
    const ch = supabase.channel(`incoming-call-${user.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "proactive_reminders", filter: `asesor_id=eq.${user.id}` },
        (p) => {
          const row = p?.new;
          if (!row || row.tipo !== "llamada_entrante") return;
          const pay = row.payload || {};
          showIncomingCall(pay.caller, pay.meet);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, clientConfig?.features?.reunionButton, showIncomingCall]);
  // Llamada entrante vía PUSH — el camino que SÍ funciona con la app abierta.
  // El SW (v272+) nos avisa por postMessage al recibir un push kind='llamada';
  // de ahí sale la pantalla estilo WhatsApp y el timbre continuo. Sin esto solo
  // sonaba el "din" único de la notificación del sistema.
  useEffect(() => {
    if (clientConfig?.features?.reunionButton !== true) return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onSwMessage = (evt) => {
      const d = evt.data;
      if (d?.type === "INCOMING_CALL") showIncomingCall(d.caller, d.meet);
    };
    navigator.serviceWorker.addEventListener("message", onSwMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onSwMessage);
  }, [clientConfig?.features?.reunionButton, showIncomingCall]);
  // «Contestar también desde la app» (pedido de Ángel 27-jul). Los dos caminos de
  // arriba solo funcionan si la app YA estaba abierta cuando llegó el aviso. Si ves
  // la notificación en el iPhone y abrís la app en vez de tocar el aviso, la llamada
  // era invisible: no había a qué darle Contestar. Acá preguntamos «¿me están
  // llamando ahora?» al abrir y cada vez que volvés a la app, con una ventana de
  // 60s (lo que dura un teléfono sonando). Handler nombrado + cleanup, como manda
  // la regla de performance del CRM.
  useEffect(() => {
    if (!user?.id || clientConfig?.features?.reunionButton !== true) return;
    let vivo = true;
    const revisarLlamada = () => {
      if (document.hidden) return;
      supabase.rpc("fn_llamada_en_curso", { p_profile_id: user.id })
        .then(({ data }) => { if (vivo && data?.meet) showIncomingCall(data.caller, data.meet); })
        .catch(() => { /* si falla, quedan los otros dos caminos */ });
    };
    revisarLlamada();
    const onVisible = () => { if (!document.hidden) revisarLlamada(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { vivo = false; document.removeEventListener("visibilitychange", onVisible); };
  }, [user?.id, clientConfig?.features?.reunionButton, showIncomingCall]);
  // La pantalla de llamada se auto-cierra a los 45s (como un teléfono que deja de sonar).
  useEffect(() => {
    if (!incomingCall) return;
    const t = setTimeout(() => {
      marcarLlamadaDespachada(incomingCall.id);
      closeCallNotifications();
      setIncomingCall(null);
    }, 45000);
    return () => clearTimeout(t);
  }, [incomingCall, closeCallNotifications]);
  // TIMBRE (solo tenants con callRingtone, ej. NSG): suena mientras hay llamada entrante.
  // Cubre las 3 salidas (Contestar/Rechazar/auto-cierre) porque todas ponen incomingCall=null.
  useEffect(() => {
    if (!incomingCall || clientConfig?.features?.callRingtone !== true) return;
    startRing();
    return () => stopRing();
  }, [incomingCall, clientConfig?.features?.callRingtone]);
  // Desbloquear el audio del timbre en el primer gesto del usuario (política de autoplay).
  useEffect(() => {
    if (clientConfig?.features?.callRingtone !== true) return;
    const onGesture = () => primeRinger();
    window.addEventListener("pointerdown", onGesture, { once: true });
    window.addEventListener("keydown", onGesture, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, [clientConfig?.features?.callRingtone]);
  // ── Aviso "Activar avisos de llamada" (tenants con reunionButton) ──────────
  // Para que el teléfono SUENE como WhatsApp cuando un compañero llama, hace
  // falta el PERMISO de notificaciones + la suscripción push — y pedir permiso
  // exige un gesto del usuario (regla de iOS/Chrome). El boot solo re-suscribe
  // si el permiso YA está dado; este aviso es el gesto que faltaba. Estados:
  //   activate → botón verde (pide permiso → suscribe → guarda endpoint)
  //   install  → iPhone sin la app en pantalla de inicio (iOS no da push sin eso)
  //   denied   → el navegador tiene los avisos bloqueados (se arregla en Ajustes)
  //   done     → confirmación breve y desaparece
  const [callPushPrompt, setCallPushPrompt] = useState(null);
  const [callPushBusy, setCallPushBusy] = useState(false);
  useEffect(() => {
    if (!user?.id || clientConfig?.features?.reunionButton !== true || isNativeApp()) return;
    try {
      const snooze = Number(localStorage.getItem("stratos_callpush_snooze") || 0);
      if (Date.now() - snooze < 20 * 3600 * 1000) return; // "Ahora no" ≈ 1 día
    } catch { /* noop */ }
    let alive = true;
    (async () => {
      try {
        const st = await getPushStatus();
        if (!alive || st.isActive) return;
        if (st.needsInstall) setCallPushPrompt("install");
        else if (st.permission === "denied") setCallPushPrompt("denied");
        else setCallPushPrompt("activate");
      } catch { /* noop */ }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, clientConfig?.features?.reunionButton]);
  const snoozeCallPush = () => {
    try { localStorage.setItem("stratos_callpush_snooze", String(Date.now())); } catch { /* noop */ }
    setCallPushPrompt(null);
  };
  const activateCallPush = async () => {
    if (callPushBusy) return;
    setCallPushBusy(true);
    try {
      const r = await enablePushNotifications(user?.id);
      if (r?.success) {
        setCallPushPrompt("done");
        setTimeout(() => setCallPushPrompt(p => (p === "done" ? null : p)), 6000);
      } else if (r?.permission === "denied") {
        setCallPushPrompt("denied");
      } else {
        // Antes esto no hacía NADA: el botón se apagaba y la persona se quedaba
        // mirando. Iván lo vivió en Mac con Brave y con Safari. Cada motivo
        // tiene ahora su pantalla, con el paso concreto que destraba.
        setCallPushPrompt(r?.motivo === "brave" ? "brave"
          : r?.motivo === "navegador" ? "navegador" : "reintentar");
      }
    } catch { /* noop */ }
    setCallPushBusy(false);
  };

  // Bandeja de WhatsApp (módulo + notificaciones de la campana). Una sola
  // suscripción realtime compartida. Gateada por el flag whatsappModule.
  const [waOpenLead, setWaOpenLead] = useState(null); // {id, ts} abrir chat desde campanita
  // MISMO predicado que el render del módulo (canAccessModule) para que la
  // campanita nunca muestre avisos que naveguen a una pantalla en blanco:
  // exige el flag + rol permitido + no-demo.
  const waEnabled = !!user && !user.isDemo && canAccessModule("wa", user, clientConfig);
  const waInbox = useWhatsAppInbox({ enabled: waEnabled });
  const waUnread = waEnabled ? (waInbox.totalUnread || 0) : 0;
  const copilotEnabled = !!user && !user.isDemo && canAccessModule("copilot", user, clientConfig);
  // ¿El usuario tiene acceso al CRM de ventas? Los de MARKETING (Alex admin o rol
  // marketing) NO — y de esto cuelga todo lo de ventas del HEADER (píldora de
  // pipeline IAOSIsland + Centro de Inteligencia con leads) y la carga de leadsData.
  // Sin esto, el gate de módulos no alcanzaba: el header se veía igual (Ángel vio
  // "$1717.9M en pipeline" en la cuenta de Alex).
  const hasCRM = !!user && canAccessModule("c", user, clientConfig);
  const copilotInbox = useCopilotInbox({ enabled: copilotEnabled, activeView: v });
  const copilotUnread = copilotEnabled ? (copilotInbox.totalUnread || 0) : 0;
  const totalNotifUnread = waUnread + copilotUnread;

  // Abre una conversación en el módulo WhatsApp desde la campanita.
  const openWaConversation = useCallback((leadId) => {
    setV("wa");
    setWaOpenLead({ id: leadId, ts: Date.now() });
    setBellOpen(false);
  }, []);
  // Click en el nombre del cliente en la bandeja de WhatsApp → abre su
  // EXPEDIENTE en el CRM (mismo panel que un click en la fila del CRM).
  const [crmAutoOpenLead, setCrmAutoOpenLead] = useState(null); // {id, ts}
  const openLeadExpediente = useCallback((leadId) => {
    if (!leadId) return;
    setV("c");
    setCrmAutoOpenLead({ id: leadId, ts: Date.now() });
  }, []);

  // ── Notificaciones de WhatsApp & Copilot ──────────────────────────────────
  // (a) Contador en el título de la pestaña: "(3) Stratos AI" — se ve aunque
  //     la asesora esté en otra pestaña. (b) Notificación nativa del navegador
  //     cuando entra un mensaje y NO está mirando la bandeja.
  const baseTitleRef = useRef(typeof document !== "undefined" ? document.title : "Stratos AI");
  useEffect(() => {
    document.title = totalNotifUnread > 0
      ? `(${totalNotifUnread > 99 ? "99+" : totalNotifUnread}) ${baseTitleRef.current}`
      : baseTitleRef.current;
    return () => { document.title = baseTitleRef.current; };
  }, [totalNotifUnread]);

  const waPrevUnreadRef = useRef(0);
  useEffect(() => {
    const prev = waPrevUnreadRef.current;
    waPrevUnreadRef.current = waUnread;
    if (!waEnabled || waUnread <= prev) return;
    // Solo avisar si NO está viendo la bandeja (otra vista o pestaña oculta).
    if (v === "wa" && !document.hidden) return;
    // notifyUser decide el canal: notificación NATIVA dentro de la app móvil
    // (la Notification API no existe en el WebView) o Notification web afuera.
    notifyUser({
      title: "WhatsApp · Stratos CRM",
      body: `${waUnread} mensaje${waUnread !== 1 ? "s" : ""} de cliente${waUnread !== 1 ? "s" : ""} sin leer`,
      tag: "stratos-wa-unread", // reemplaza el aviso anterior, no apila
      onClick: () => setV("wa"),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waUnread, waEnabled]);

  const copilotPrevUnreadRef = useRef(0);
  useEffect(() => {
    const prev = copilotPrevUnreadRef.current;
    copilotPrevUnreadRef.current = copilotUnread;
    if (!copilotEnabled || copilotUnread <= prev) return;
    if (v === "copilot" && !document.hidden) return;
    notifyUser({
      title: "Copilot AI · Stratos CRM",
      body: copilotInbox.lastAiMessage?.content?.slice(0, 110) || "Nueva respuesta de tu asistente IA",
      tag: "stratos-copilot-unread",
      onClick: () => setV("copilot"),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copilotUnread, copilotEnabled, copilotInbox.lastAiMessage]);

  // App NATIVA: pedir el permiso de notificaciones al entrar (Android 13+ lo
  // exige en runtime; el diálogo sale una sola vez) y navegar a la bandeja de
  // WhatsApp cuando el usuario toca una notificación.
  //
  // ⚠️ Acá NO se pide el permiso. Se pedia, y competia con el registro de push
  // de abajo: los dos abren el mismo dialogo del sistema, uno gana y el otro
  // recibe una respuesta que no es "concedido". El que perdia se quedaba
  // convencido de que faltaba el permiso —para siempre, porque este efecto solo
  // corre al cambiar de usuario— aunque iOS ya lo hubiera concedido.
  //
  // Ahora el permiso lo pide un solo lugar, en orden, en el efecto de abajo.
  useEffect(() => {
    if (!user || !isNativeApp()) return;
    return addNotificationTapListener(() => setV("wa"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── EL PERMISO SE PIDE AL ABRIR LA APP, COMO CUALQUIER OTRA ──────────────
  //
  // Antes se pedía recién DESPUÉS de iniciar sesión, y eso está mal por dos
  // razones. La obvia: una app recién instalada pide sus permisos al abrirse,
  // no escondidos detrás de un login — la persona no entiende por qué le
  // aparece un diálogo del sistema en medio de otra cosa (Ángel, 27-ago-2026).
  //
  // Y la que rompía de verdad: quien abría la app, entraba, y NO llegaba a
  // responder el diálogo antes de que el registro consultara el permiso, se
  // quedaba sin avisos para siempre — el registro lo veía «sin responder» y no
  // volvía a intentarlo.
  //
  // Pedirlo acá lo resuelve de raíz: para cuando hay sesión, la respuesta ya
  // está dada. Corre una sola vez por apertura y no depende de nadie.
  //
  // Los otros permisos (micrófono, cámara, fotos) NO van acá a propósito: iOS
  // obliga a pedirlos en el momento de usarlos, y pedirlos de golpe al abrir es
  // la forma más rápida de que digan que no a todo.
  useEffect(() => {
    if (!isNativeApp()) return;
    prepararAvisos()
      .then(() => ensureNotifPermission())
      .catch(() => { /* nunca romper el arranque por un aviso */ });
  }, []);

  // PUSH NATIVO (APNs). Es el que llega con la app CERRADA: un lead que entra a
  // las 11 de la noche despierta el teléfono del asesor. Las notificaciones de
  // arriba son locales y solo aparecen si la app ya está abierta.
  //
  // Se arranca DESPUÉS del login porque el token hay que ligarlo a un usuario;
  // sin eso el servidor no sabría a qué teléfono mandar el aviso. Al cerrar
  // sesión se borra el token, o el teléfono seguiría recibiendo los leads del
  // usuario anterior.
  useEffect(() => {
    if (!user?.id || !isNativeApp()) return;
    const uid = user.id;

    // El permiso ya se pidió al abrir la app (efecto de arriba), así que acá
    // solo queda ligar este teléfono al usuario que entró. prepararAvisos se
    // vuelve a llamar por si esta sesión empezó sin pasar por el arranque; es
    // idempotente y no cuesta nada.
    prepararAvisos()
      .then(() => {
        iniciarPushNativo(uid, (data) => {
          // El payload manda a donde ir. Por defecto, al CRM.
          const destino = typeof data?.view === "string" ? data.view : "c";
          setV(destino);
        });
        // Los recordatorios con hora conocida se dejan agendados en el propio
        // telefono: suenan con la app cerrada y sin internet, sin depender de
        // que un servidor acierte a despertarla.
        return sincronizarRecordatorios(uid);
      })
      .catch(() => { /* nunca romper el arranque por un aviso */ });

    // Se reprograma en los DOS momentos que importan, y el segundo es el que
    // de verdad hace que esto sirva:
    //
    //   · al VOLVER: el usuario pudo haber agendado o cerrado recordatorios
    //     desde la computadora mientras la app estaba guardada.
    //   · al IRSE al fondo: es el instante exacto en que el telefono pasa a
    //     hacerse cargo. Sin esto, alguien que le pide al Copilot "recordame en
    //     tres minutos" y enseguida bloquea el telefono se queda SIN el aviso:
    //     el recordatorio se creo despues de la ultima sincronizacion y nadie
    //     lo dejo agendado. Es el caso mas comun de todos.
    const alCambiarVisibilidad = () => {
      sincronizarRecordatorios(uid).catch(() => {});
    };
    document.addEventListener("visibilitychange", alCambiarVisibilidad);

    // Red de seguridad, porque lo de arriba es una CARRERA que se puede perder:
    // cuando la app se va al fondo, iOS congela el navegador de adentro casi de
    // inmediato, y la consulta puede quedar a medio camino. Este repaso cada
    // minuto —solo con la app a la vista, no gasta bateria de fondo— hace que un
    // recordatorio recien creado quede agendado antes de que el usuario cierre.
    // Es barato: una consulta filtrada por asesor y con tope de 48 filas.
    const repaso = setInterval(() => {
      if (!document.hidden) sincronizarRecordatorios(uid).catch(() => {});
    }, 60000);

    // ANDROID: la llamada ABRE la app encima de todo, pero no le cuenta al CRM
    // por qué se abrió. Así que el CRM lo pregunta: si hay una llamada de hace
    // menos de un minuto, muestra la pantalla. Se consulta al abrir y cada vez
    // que la app vuelve al frente, que son los dos momentos en que puede haber
    // entrado una mientras no mirábamos.
    const mirarSiLlaman = () => {
      if (document.hidden) return;
      llamadaEnCurso(uid)
        .then((l) => { if (l) showIncomingCall(l.caller, l.meet, l.id); })
        .catch(() => {});
    };
    mirarSiLlaman();
    document.addEventListener("visibilitychange", mirarSiLlaman);

    // LLAMADAS A PANTALLA COMPLETA (solo iPhone). Es un canal aparte del de los
    // avisos: si esto falla, la llamada sigue llegando como una tira normal.
    const soltar = engancharLlamadas(uid, () => {
      // ⚠️ La reunión la abre el TELÉFONO, no el CRM (LlamadaEntrante.swift).
      //
      // Acá se intentaba abrirla con `window.open` y no funcionaba nunca en el
      // caso que importa: contestar desde la pantalla bloqueada NO trae la app
      // al frente, así que el CRM sigue dormido y no hay nadie que ejecute ese
      // `window.open`. Ángel contestó, la llamada se dio por terminada y no lo
      // llevó a ningún lado (27-ago-2026).
      //
      // Además Google Meet necesita cámara y micrófono, y dentro de la ventana
      // del CRM eso no funciona bien: afuera se abre la app de Meet si está
      // instalada, y si no, el navegador.
      //
      // Un solo dueño para abrir la reunión, y es el que siempre está despierto.
      // Acá solo se deja el CRM donde tiene sentido volver después.
      setV("copilot");
    });

    return () => {
      clearInterval(repaso);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      document.removeEventListener("visibilitychange", mirarSiLlaman);
      soltar();
      soltarLlamadas(uid);
      detenerPushNativo(uid);
      limpiarRecordatorios();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // WEB PUSH (PWA "Agregar a inicio"): inicializa el contexto de push,
  // registra el handler de clicks en notificaciones, e intenta restaurar
  // la suscripción si ya existía. El permiso SOLO se pide desde un botón
  // visible (el diálogo nativo de iOS Safari/PWA no se puede disparar sin
  // gesto del usuario). La app nativa (Capacitor) ya tiene su propio flujo
  // arriba y NO pasa por acá.
  useEffect(() => {
    if (!user || isNativeApp()) return;
    try {
      // Inicializar el contexto de Supabase para guardar suscripciones
      initPushContext(
        import.meta.env.VITE_SUPABASE_URL || 'https://glulgyhkrqpykxmujodb.supabase.co',
        import.meta.env.VITE_SUPABASE_ANON_KEY || '',
      );
      // Registrar handler de clicks en notificaciones push
      const cleanup = onNotificationClick((data) => {
        try {
          // Si la notificación pide abrir una vista específica, navegar a ella
          if (data.view && typeof setV === 'function') {
            setV(data.view);
          }
          // Enfocar la ventana
          if (typeof window !== 'undefined') window.focus();
        } catch { /* noop */ }
      });

      // AUTO-SUSCRIBIR: si el permiso YA está concedido, suscribir en silencio y
      // guardar el endpoint. `subscribe()` NO requiere gesto del usuario (solo
      // `requestPermission()` lo requiere), así que esto se puede correr al boot.
      // ⚠️ Es lo que FALTABA: antes la app solo inicializaba el contexto pero
      // NUNCA llamaba a subscribe → push_subscriptions quedaba VACÍA → jamás
      // llegaba un push real (con la app cerrada). Correrlo en cada apertura
      // además RE-suscribe si iOS rotó/expiró la suscripción. El botón visible
      // (banner del Copilot) cubre el caso permiso='default' (necesita gesto).
      (async () => {
        try {
          const st = await getPushStatus();
          if (st.supported && st.permission === 'granted') {
            const sub = await subscribeToPush();
            if (sub && user?.id) await saveSubscriptionToBackend(user.id, sub);
          }
        } catch { /* noop — el banner del Copilot ofrece activarlas manualmente */ }
      })();

      return cleanup;
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  /* ── Theme ── */
  const [theme, setThemeState] = useState(() => {
    try { return localStorage.getItem("stratos_crm_theme") || "dark"; } catch { return "dark"; }
  });
  const themeSwitchingRef = useRef(false);
  // data-theme en <html>: mobile-perf.css lo usa para que el fondo forzado
  // del MODO SEGURO (data-lowfx) respete el tema claro. index.html lo setea
  // al boot; acá lo mantenemos en sync cuando el usuario alterna el tema.
  useEffect(() => {
    try { document.documentElement.setAttribute("data-theme", theme); } catch { /* noop */ }
    // El re-skin del tema re-renderiza TODO; en el WebView de Android el área
    // de contenido puede quedar corrida unos px hacia arriba DESPUÉS del primer
    // frame (reflows tardíos / scrolls programáticos) → el título del módulo
    // "tapado" bajo el header (reporte de Ángel v1.5/v1.6, solo al pasar a
    // claro). Un único scrollTo en el efecto llegaba demasiado TEMPRANO: acá se
    // re-afirma el tope varias veces mientras el re-skin asienta. El primer
    // gesto del usuario cancela el pin (no peleamos con un swipe legítimo).
    let cancelled = false;
    const cancelPin = () => { cancelled = true; };
    window.addEventListener("touchstart", cancelPin, { once: true, passive: true });
    window.addEventListener("wheel", cancelPin, { once: true, passive: true });
    const pin = () => {
      if (cancelled) return;
      try { const ca = document.querySelector(".stratos-content-area"); if (ca && ca.scrollTop !== 0) ca.scrollTop = 0; } catch { /* noop */ }
    };
    pin();
    const raf = requestAnimationFrame(pin);
    const timers = [120, 300, 650, 1100].map(ms => setTimeout(pin, ms));
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      window.removeEventListener("touchstart", cancelPin);
      window.removeEventListener("wheel", cancelPin);
    };
  }, [theme]);

  // [guard:SCROLL-DRIFT] — guardián PERMANENTE del tope en móvil (v1.8).
  // Historia: en el WebView del celular el área de contenido aparecía corrida
  // unos px hacia arriba (título del módulo bajo el header) en momentos que NO
  // podemos enumerar por completo (cambio de tema, datos que llegan, reflows
  // tardíos; reportes de Ángel v1.5-v1.7 — el pin del tema no alcanzó para el
  // CRM). Regla estructural: el contenido NUNCA puede quedar EN REPOSO corrido
  // 1-60px sin que el usuario haya arrastrado — esa franja solo la produce el
  // drift. Cómo: escucha scroll en captura (document) del .stratos-content-area
  // (sobrevive al remount key={v}); cuando el scroll SE ASIENTA (260ms sin
  // eventos) dentro de la franja y no hubo arrastre real (touchmove/rueda) en
  // los últimos 1.2s, vuelve al tope. Un scroll legítimo del usuario siempre
  // viene de un arrastre → jamás se pelea con el dedo; los scrolls suaves
  // programáticos largos (ej. centrar el lead recién registrado) terminan
  // fuera de la franja y tampoco se tocan. Solo pointer coarse (celular).
  useEffect(() => {
    if (!window.matchMedia || !window.matchMedia("(pointer: coarse)").matches) return undefined;
    let lastDrag = 0;
    let settleTimer = 0;
    const markDrag = () => { lastDrag = Date.now(); };
    const onAnyScroll = (e) => {
      const ca = e.target;
      if (!(ca instanceof Element) || !ca.classList || !ca.classList.contains("stratos-content-area")) return;
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        try {
          const st = ca.scrollTop;
          if (st > 0 && st <= 60 && Date.now() - lastDrag > 1200) ca.scrollTop = 0;
        } catch { /* noop */ }
      }, 260);
    };
    window.addEventListener("touchmove", markDrag, { passive: true });
    window.addEventListener("wheel", markDrag, { passive: true });
    document.addEventListener("scroll", onAnyScroll, true);
    return () => {
      clearTimeout(settleTimer);
      window.removeEventListener("touchmove", markDrag);
      window.removeEventListener("wheel", markDrag);
      document.removeEventListener("scroll", onAnyScroll, true);
    };
  }, []);
  const setTheme = useCallback((next) => {
    if (themeSwitchingRef.current) return;
    themeSwitchingRef.current = true;
    try { localStorage.setItem("stratos_crm_theme", next); } catch { /* storage puede estar bloqueado */ }
    const root = document.documentElement;

    // Primero pintamos una pantalla de espera independiente del árbol React.
    // Dos frames garantizan que aparezca ANTES del re-render pesado; si la CPU
    // se satura, el usuario ve carga en vez de una interfaz a medio recolorear.
    root.classList.remove("theme-loading-light", "theme-loading-dark");
    root.classList.add(`theme-loading-${next}`, "theme-loading-active");
    root.setAttribute("aria-busy", "true");
    const shownAt = performance.now();
    let safetyTimer = 0;
    const finishThemeSwitch = () => {
      window.clearTimeout(safetyTimer);
      root.classList.remove("theme-loading-active", "theme-loading-light", "theme-loading-dark");
      root.removeAttribute("aria-busy");
      themeSwitchingRef.current = false;
    };
    // Última red de seguridad: ninguna excepción o throttling extremo puede
    // dejar la cortina bloqueada permanentemente.
    safetyTimer = window.setTimeout(finishThemeSwitch, 3000);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      try {
        flushSync(() => setThemeState(next));
        root.setAttribute("data-theme", next);
      } catch {
        finishThemeSwitch();
        return;
      }

      // La cortina debe alcanzar a percibirse también en equipos rápidos. En
      // uno lento permanece naturalmente hasta que el commit termina detrás.
      const remaining = Math.max(0, 650 - (performance.now() - shownAt));
      window.setTimeout(() => requestAnimationFrame(finishThemeSwitch), remaining);
    }));
  }, []);
  const isLight = theme === "light";
  const T = isLight ? LP : P;

  /* ── Leads data — shared between Dash & CRM ── */
  const [leadsData, setLeadsData]       = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  // Score del asesor = promedio del SCORE de su cartera visible (0-100). Se
  // muestra como badge junto a la flecha del Copilot (estilo el "180" de
  // WhatsApp, pero con el pulso de la cartera). Sin leads con score → null.
  const asesorScore = useMemo(() => {
    const s = leadsData.map(l => Number(l?.score)).filter(n => Number.isFinite(n) && n > 0);
    return s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null;
  }, [leadsData]);
  const [leadsRefreshing, setLeadsRefreshing] = useState(false); // caché pintada, trayendo el set completo (orden final) en background

  // Cache de filas ya normalizadas. Clave = id, valor = { stamp, row }.
  // stamp = updated_at || created_at — si no cambió, devolvemos la MISMA
  // referencia, así React.memo / useMemo aguas abajo evita re-renders y
  // ahorramos el JSON.parse x3 por fila en cada refresh. Sin invalidación
  // por tamaño: el cache crece a lo sumo al # de leads de la org (~1K max),
  // memoria despreciable. Si el contenido cambia (updated_at avanza),
  // re-normalizamos y reemplazamos la entrada.
  const normalizeCache = useRef(new Map());

  const normalizeLeads = useCallback((rows) => {
    const cache = normalizeCache.current;
    return rows.map(l => {
      const stamp = l.updated_at || l.created_at || '';
      const cached = cache.get(l.id);
      if (cached && cached.stamp === stamp) return cached.row;
      // Preferencia para `nextActionDate` cuando hay cita real agendada
      // (selected_time poblado por Cal.com vía book_appointment / webhook):
      // mostramos esa fecha formateada en español en vez del texto
      // `next_action_date` que puede contener un timestamp viejo (ej. el
      // momento en que el upsert seteó next_action_at +5min antes del
      // rescate). El usuario reportó que la tarjeta mostraba la fecha de
      // entrada del lead en lugar de la fecha del Zoom — esto lo resuelve
      // sin tocar la DB. Solo aplica a etapas con cita; para el resto se
      // mantiene `next_action_date` tal cual.
      // Fecha de cita/zoom "completa con palabras" para que el cliente la lea
      // claro (ej. "Sábado 20 de junio, 2:30 p.m."). Preferimos selected_time
      // (cita real de Cal.com); si no, intentamos next_action_date cuando trae
      // un datetime parseable. Texto libre ("Esta semana") se respeta tal cual.
      let displayActionDate = l.next_action_date;
      if (STAGES_CON_CITA.has(l.stage)) {
        // Preferimos los timestamps reales de la cita: selected_time (Cal.com) y
        // next_action_at (fn_register_appointment) traen fecha + hora. En leads
        // de Duke `next_action_date` es solo "YYYY-MM-DD" (sin hora), así que se
        // usa de último recurso. Texto libre ("Esta semana") se respeta tal cual.
        const larga = formatFechaLarga(l.selected_time || l.next_action_at || l.next_action_date);
        if (larga) displayActionDate = larga;
      }
      const normalized = {
        ...l,
        n:              l.name,
        st:             l.stage,
        sc:             l.score,
        p:              l.project,
        campana:        l.campaign,
        hot:            l.hot,
        isNew:          l.is_new,
        nextAction:     l.next_action,
        nextActionDate: displayActionDate,
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
      };
      cache.set(l.id, { stamp, row: normalized });
      return normalized;
    });
  }, []);

  // Cache local de leads en localStorage (stale-while-revalidate).
  // En F5/login pintamos esta versión cacheada al instante, mientras Supabase
  // responde. Cuando llega la respuesta fresca la reemplazamos.
  // Scope por user.id para que distintas cuentas no se mezclen.
  // El listener de SIGNED_OUT en AuthContext ya limpia este storage.
  const leadsCacheKey = user?.id ? `stratos.leads.cache.${user.id}` : null;

  const readLeadsCache = useCallback(() => {
    if (!leadsCacheKey) return null;
    try {
      const raw = localStorage.getItem(leadsCacheKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Sanity check: payload debe ser un array no vacío con shape de lead
      if (!Array.isArray(parsed?.rows) || parsed.rows.length === 0) return null;
      if (!parsed.rows[0]?.id) return null;
      return parsed.rows;
    } catch (_) { return null; }
  }, [leadsCacheKey]);

  // FIX (F5 perdía leads ~10s): la versión anterior usaba requestIdleCallback
  // con timeout 2s. Si el usuario refrescaba antes de que disparara, el cache
  // NO se persistía → F5 quedaba sin cache → esperaba a Supabase (10s con red
  // lenta o cold start). Ahora persistimos SIEMPRE, con doble estrategia:
  //   · escritura sync inmediata (garantiza persistencia ante F5 instantáneo)
  //   · El JSON.stringify de ~1K leads tarda <30ms en PC normal — antes el
  //     bloqueo era >200ms porque incluía 500 entries del mirror de leads,
  //     no este cache que es el array completo.
  const writeLeadsCache = useCallback((rows) => {
    if (!leadsCacheKey || !Array.isArray(rows)) return;
    // Acotar a los N más recientes para no llenar la cuota de localStorage y
    // desplazar el token de Supabase (ver LEADS_CACHE_LIMIT). El array ya viene
    // ordenado por created_at desc (fetch + realtime prepend), así que el slice
    // conserva los leads más recientes — los que más importan en el paint de F5.
    const capped = rows.length > LEADS_CACHE_LIMIT ? rows.slice(0, LEADS_CACHE_LIMIT) : rows;
    try {
      localStorage.setItem(leadsCacheKey, JSON.stringify({ rows: capped, ts: Date.now() }));
    } catch (_) {
      // Cuota llena pese al tope (otras keys grandes): mejor un caché vacío que
      // uno corrupto a medias. Lo limpiamos para no servir datos truncados y
      // para liberar espacio al token de sesión, que es lo crítico.
      try { localStorage.removeItem(leadsCacheKey); } catch (_) { /* noop */ }
    }
  }, [leadsCacheKey]);

  const fetchLeads = useCallback(async ({ silent = false } = {}) => {
    // Si NO es silent y hay cache, pintamos cache primero y dejamos
    // leadsLoading=false (UX: leads aparecen al instante en F5/login).
    // El fetch a la red continúa y reemplaza con datos frescos al volver.
    const cached = !silent ? readLeadsCache() : null;
    if (cached) {
      setLeadsData(normalizeLeads(cached));
      setLeadsLoading(false);
      setLeadsRefreshing(true); // muestra "Actualizando lista…" hasta que llegue el set completo y se reordene
    } else if (!silent) {
      setLeadsLoading(true);
    }

    // Modo offline: cargar del JSON estático + overlay localStorage
    if (user?._offline) {
      try {
        const offlineLeads = await getOfflineLeads(user);
        setLeadsData(normalizeLeads(offlineLeads));
      } catch (e) {
        console.warn('[Stratos] Error cargando leads offline:', e);
        if (!cached) setLeadsData([]);
      }
      setLeadsLoading(false);
      setLeadsRefreshing(false);
      return;
    }

    // Modo online normal — PAGINADO.
    // Antes era un solo .select() que PostgREST truncaba en 1000 filas, así que
    // con >1000 leads activos el CRM "perdía" los más antiguos y el contador se
    // quedaba clavado en 1000. Paginamos para traerlos todos.
    const { data, error } = await fetchAllPaged(() =>
      supabase
        .from('leads').select('*').is('deleted_at', null)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false }) // desempate estable en el borde de página
    );
    if (!error) {
      setLeadsData(normalizeLeads(data));
      writeLeadsCache(data);
    } else if (!cached) {
      // Supabase falló y no había cache — intentar offline como último recurso
      console.warn('[Stratos] Supabase leads falló, intentando offline:', error.message);
      try {
        const offlineLeads = await getOfflineLeads(user);
        if (offlineLeads.length > 0) setLeadsData(normalizeLeads(offlineLeads));
      } catch (_) { /* noop */ }
    }
    setLeadsLoading(false);
    setLeadsRefreshing(false);
  }, [normalizeLeads, user, readLeadsCache, writeLeadsCache]);

  useEffect(() => {
    if (!user) return;
    // Marketing (Alex admin o rol marketing): NO se cargan leads de ventas. Así el
    // header y todo lo que deriva de leadsData quedan vacíos/apagados para ellos.
    if (!canAccessModule("c", user, clientConfig)) { setLeadsData([]); setLeadsLoading(false); return; }
    if (user.id === 'demo-user-local') {
      // Demo: los leads no tienen `created_at` (solo `fechaIngreso` formateado).
      // Para que el Comando Directivo y AdvisorMetrics muestren métricas reales
      // y no ceros, sintetizamos un `created_at` distribuido en los últimos
      // 60 días — orden estable basado en índice. Si una entrada ya tiene
      // `created_at`, se respeta.
      const MES_ABBR = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
      const parseFechaIngreso = (str) => {
        if (!str || typeof str !== 'string') return null;
        const m = str.match(/^(\d+)\s+(\w+),?\s+(\d+):(\d+)\s*(am|pm)?$/i);
        if (!m) return null;
        const day = parseInt(m[1], 10);
        const monthIdx = MES_ABBR.findIndex(x => x.toLowerCase() === m[2].toLowerCase());
        if (monthIdx < 0) return null;
        let hour = parseInt(m[3], 10);
        const min = parseInt(m[4], 10);
        const ampm = (m[5] || '').toLowerCase();
        if (ampm === 'pm' && hour < 12) hour += 12;
        if (ampm === 'am' && hour === 12) hour = 0;
        const now = new Date();
        let year = now.getFullYear();
        let candidate = new Date(year, monthIdx, day, hour, min);
        if (candidate.getTime() > now.getTime()) {
          candidate = new Date(year - 1, monthIdx, day, hour, min);
        }
        return candidate.toISOString();
      };
      const now = Date.now();
      const spreadMs = 60 * 24 * 60 * 60 * 1000;
      const denom = Math.max(1, leads.length - 1);
      setLeadsData(leads.map((l, i) => ({
        ...l,
        seguimientos: l.seguimientos ?? 0,
        created_at:   l.created_at
          || parseFechaIngreso(l.fechaIngreso)
          || new Date(now - (i / denom) * spreadMs).toISOString(),
      })));
      setLeadsLoading(false);
      return;
    }
    fetchLeads();
    // Solo subscribir al realtime si NO estamos offline
    if (user._offline) return;

    // Realtime: aplicar el cambio del payload directamente al estado local,
    // SIN re-fetchear toda la tabla. Antes cada evento disparaba un
    // SELECT * (~600KB-1MB) que duraba 400-800ms y pisaba el optimistic UI.
    // Ahora el payload de Supabase ya trae la fila completa; la metemos al
    // array sin tocar la red. fetchLeads() queda como fallback de seguridad
    // si el payload viene degenerado (sin id o sin stage).
    let fallbackTimer = null;
    const scheduleFallback = () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      fallbackTimer = setTimeout(fetchLeads, 0);
    };
    // Salvaguarda: si la fila no tiene los campos críticos esperados,
    // caemos a fetchLeads() para preservar el comportamiento previo.
    const isPayloadValid = (row) => row && row.id && (row.stage || row.deleted_at !== undefined);

    const ch = supabase.channel('leads-global')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, (p) => {
        const row = p?.new;
        if (!isPayloadValid(row)) return scheduleFallback();
        // INSERT con deleted_at ya seteado (raro): ignorar para el activo.
        if (row.deleted_at) return;
        const [normalized] = normalizeLeads([row]);
        setLeadsData(prev => {
          // Evitar duplicados (echo del propio insert que ya hizo optimistic).
          if (prev.some(l => l.id === normalized.id)) return prev;
          // Mantener orden por created_at desc → INSERT nuevo va al inicio.
          return [normalized, ...prev];
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, (p) => {
        const row = p?.new;
        if (!isPayloadValid(row)) return scheduleFallback();
        // UPDATE con deleted_at no nulo = soft-delete desde otro cliente.
        // Lo removemos del array activo. (La papelera se refresca al montar
        // o cuando el usuario abre esa vista, igual que antes.)
        if (row.deleted_at) {
          setLeadsData(prev => prev.filter(l => l.id !== row.id));
          return;
        }
        const [normalized] = normalizeLeads([row]);
        setLeadsData(prev => {
          const idx = prev.findIndex(l => l.id === normalized.id);
          if (idx === -1) {
            // Restore desde papelera (otro cliente removió deleted_at).
            return [normalized, ...prev];
          }
          const next = prev.slice();
          next[idx] = normalized;
          return next;
        });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'leads' }, (p) => {
        const oldId = p?.old?.id;
        if (!oldId) return scheduleFallback();
        setLeadsData(prev => prev.filter(l => l.id !== oldId));
      })
      .subscribe();
    return () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      supabase.removeChannel(ch);
    };
  }, [user, fetchLeads]);

  // FIX (F5 perdía leads): los handlers de realtime arriba mutan leadsData
  // pero NO re-escribían el cache. Si el usuario hacía cambios y luego F5,
  // el cache quedaba stale (o vacío si nunca se llegó a persistir tras login).
  // Ahora re-persistimos el array completo cada vez que leadsData cambia,
  // con debounce 800ms para amortiguar ráfagas (10 cambios = 1 escritura).
  useEffect(() => {
    if (!leadsCacheKey || leadsData.length === 0) return;
    const t = setTimeout(() => writeLeadsCache(leadsData), 800);
    return () => clearTimeout(t);
  }, [leadsData, leadsCacheKey, writeLeadsCache]);

  // ══════════════════════════════════════════════════════════════════════
  // SOFT-DELETE / PAPELERA
  // ══════════════════════════════════════════════════════════════════════
  // El schema de leads tiene `deleted_at timestamptz NULL`. Las queries
  // normales filtran por deleted_at IS NULL. Aquí exponemos:
  //   · softDeleteLead(id)     → mueve a la papelera (set deleted_at = now())
  //   · restoreLead(id)        → restaura (set deleted_at = null)
  //   · hardDeleteLead(id)     → DELETE definitivo, solo super_admin/admin
  //   · trashedLeads (state)   → lista de leads con deleted_at NOT NULL
  //   · refreshTrash()         → recarga la papelera bajo demanda
  // ══════════════════════════════════════════════════════════════════════
  const [trashedLeads, setTrashedLeads] = useState([]);

  const refreshTrash = useCallback(async () => {
    if (!user || user.id === 'demo-user-local') return;
    // Paginado por la misma razón que el fetch activo: la papelera puede superar
    // las 1000 filas con el tiempo y PostgREST las truncaría.
    const { data, error } = await fetchAllPaged(() =>
      supabase
        .from('leads').select('*')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
        .order('id', { ascending: false })
    );
    if (!error && data) setTrashedLeads(normalizeLeads(data));
  }, [user, normalizeLeads]);

  // Cargar papelera al montar y cuando cambia user
  useEffect(() => {
    if (!user || user.id === 'demo-user-local' || user._offline) return;
    refreshTrash();
  }, [user, refreshTrash]);

  const softDeleteLead = useCallback(async (leadId) => {
    if (!leadId) return { ok: false, error: 'ID inválido' };
    // Optimistic: quitar del estado activo inmediatamente
    setLeadsData(prev => prev.filter(l => l.id !== leadId));
    if (user?.id === 'demo-user-local' || user?.isDemo) return { ok: true };
    const { error } = await supabase
      .from('leads')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', leadId);
    if (error) {
      // Rollback — re-fetch para restaurar. silent=true: no pintar cache stale
      // que volvería a meter el lead que el optimistic UI acaba de quitar.
      fetchLeads({ silent: true });
      return { ok: false, error: error.message };
    }
    refreshTrash();
    return { ok: true };
  }, [user, fetchLeads, refreshTrash]);

  const restoreLead = useCallback(async (leadId) => {
    if (!leadId) return { ok: false, error: 'ID inválido' };
    // Optimistic: quitar de papelera inmediatamente
    setTrashedLeads(prev => prev.filter(l => l.id !== leadId));
    if (user?.id === 'demo-user-local' || user?.isDemo) return { ok: true };
    const { error } = await supabase
      .from('leads')
      .update({ deleted_at: null })
      .eq('id', leadId);
    if (error) {
      refreshTrash();
      return { ok: false, error: error.message };
    }
    fetchLeads({ silent: true });
    return { ok: true };
  }, [user, fetchLeads, refreshTrash]);

  const hardDeleteLead = useCallback(async (leadId) => {
    if (!leadId) return { ok: false, error: 'ID inválido' };
    if (!["super_admin", "admin"].includes(user?.role))
      return { ok: false, error: 'Solo super_admin/admin pueden eliminar definitivamente' };
    setTrashedLeads(prev => prev.filter(l => l.id !== leadId));
    const { error } = await supabase.from('leads').delete().eq('id', leadId);
    if (error) {
      refreshTrash();
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }, [user, refreshTrash]);

  /* ── Modo offline: contador de cambios pendientes + sync ── */
  const [pendingSync, setPendingSync] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  // Mostrar banner solo a roles administrativos. Asesores nunca lo ven.
  // Trabajan fluido sin saber que estaban en modo offline.
  const ADMIN_ROLES = ["super_admin", "admin", "ceo"];
  const isAdminRole = ADMIN_ROLES.includes(user?.role);
  const showOfflineBanner = isAdminRole && (user?._offline || pendingSync > 0);

  // Polling cada 5 s del contador de cambios pendientes.
  // Pausa cuando la pestaña está en background (document.hidden) para no
  // gastar CPU/red sin beneficio; al volver al foreground reanuda inmediato.
  useEffect(() => {
    if (!user || user.id === 'demo-user-local') return;
    const tick = () => setPendingSync(getPendingSyncCount());
    let t = null;
    const start = () => { if (t == null) { tick(); t = setInterval(tick, 5000); } };
    const stop  = () => { if (t != null) { clearInterval(t); t = null; } };
    const onVisibility = () => (document.hidden ? stop() : start());
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, [user?.id]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncMsg("");
    const { ok, synced, failed } = await syncToSupabase(supabase);
    setSyncing(false);
    setPendingSync(getPendingSyncCount());
    if (ok && synced > 0) {
      setSyncMsg(`✅ ${synced} cambios sincronizados.`);
      setTimeout(() => setSyncMsg(""), 4000);
      // Refrescar de Supabase tras sync exitoso. silent: el estado local
      // ya está al día por el optimistic UI; no pintar cache stale.
      fetchLeads({ silent: true });
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
          // Refrescar leads de Supabase para tener la versión canónica.
          // silent: estado local ya tiene los cambios optimistas.
          fetchLeads({ silent: true });
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
  // FIX (perf): el listener de `visibilitychange` antes era una función
  // anónima inline y el cleanup NO la removía. Como el effect depende de
  // `runAutoRecovery` (que cambia con [user, upgradeToOnline, fetchLeads,
  // isAdminRole]), cada re-render acumulaba un listener huérfano. En 5 min
  // de uso quedaban 100+ listeners encolados → cada cambio de visibilidad
  // disparaba 100+ callbacks → main thread bloqueado → mouse stutters.
  // Ahora la función está nombrada y el cleanup la remueve correctamente.
  useEffect(() => {
    const onWake = () => runAutoRecovery();
    const onVisibilityChange = () => {
      if (!document.hidden) runAutoRecovery();
    };
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [runAutoRecovery]);

  // ── PREFETCH de las vistas lazy (evita "chunk viejo" al navegar tras deploy) ──
  // Precargamos en segundo plano los chunks de todas las vistas contra el bundle
  // ACTUAL. Los errores se tragan en silencio para no gatillar el recovery global
  // (vite:preloadError). Corre una sola vez.
  //
  // ⚠️ REESCRITO 17-ago-2026 — esto era parte del "se queda cargando" del celular.
  // La versión anterior disparaba las 13 vistas de golpe a los 1,5 s (Safari, que
  // no siempre tiene requestIdleCallback) o a los 4 s forzados por el `timeout`
  // —que NO significa "cuando esté ocioso", significa "a los 4 s aunque esté
  // ocupado"—. Medido en producción: 114 archivos de JavaScript en el arranque,
  // los últimos (WhatsApp, Profile, Marketing, AdminPanel) entrando a los 5,1 s.
  // O sea: mientras el asesor mira el splash, el teléfono está bajando pantallas
  // que no pidió, robándole red y CPU justo a lo que sí necesita para abrir.
  //
  // Ahora, tres frenos, en orden:
  //   1. Espera al `load` de la ventana: recién cuando lo que SÍ hace falta
  //      terminó de bajar, empezamos con lo opcional. Nunca compite con el arranque.
  //   2. Se saltea entero si el teléfono está en ahorro de datos o en una red
  //      lenta (2G/3G): ahí precargar 13 pantallas hace más daño que bien.
  //      El chunk se baja igual cuando el usuario entra a esa pantalla.
  //   3. Va de a UNA vista por vez, con respiro entre cada una, en vez de las 13
  //      juntas. Una conexión de celular con 100 peticiones en paralelo se
  //      atraganta; escalonado, ninguna le quita el lugar a lo importante.
  // Reversible: este bloque se borra y todo sigue andando — el prefetch es una
  // comodidad, no un requisito; sin él la vista se baja al entrar.
  useEffect(() => {
    let cancelled = false;

    // Red pobre o ahorro de datos → no precargamos nada.
    const redFloja = () => {
      try {
        const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (!c) return false;                              // sin dato: seguimos normal
        if (c.saveData) return true;                       // el usuario pidió ahorrar datos
        return /(^|-)2g$/.test(c.effectiveType || "") || c.effectiveType === "3g";
      } catch (_) { return false; }
    };

    let timerVista = null;
    const warm = () => {
      if (cancelled || redFloja()) return;
      let i = 0;
      const siguiente = () => {
        if (cancelled || i >= PREFETCH_VIEWS.length) return;
        const load = PREFETCH_VIEWS[i++];
        try { const p = load(); if (p && p.catch) p.catch(() => {}); } catch (_) { /* noop */ }
        timerVista = setTimeout(siguiente, 300);           // respiro entre vista y vista
      };
      siguiente();
    };

    // Arranca DESPUÉS del load, y todavía espera a un hueco ocioso.
    let idOcio = null;
    let timerArranque = null;
    const programar = () => {
      if (cancelled) return;
      const ric = typeof window !== "undefined" && window.requestIdleCallback;
      if (ric) idOcio = window.requestIdleCallback(warm, { timeout: 10000 });
      else timerArranque = setTimeout(warm, 3000);
    };
    if (document.readyState === "complete") programar();
    else window.addEventListener("load", programar, { once: true });

    return () => {
      cancelled = true;
      try {
        window.removeEventListener("load", programar);
        if (idOcio != null && window.cancelIdleCallback) window.cancelIdleCallback(idOcio);
        if (timerArranque) clearTimeout(timerArranque);
        if (timerVista) clearTimeout(timerVista);
      } catch (_) { /* noop */ }
    };
  }, []);

  /* ── IAOS ticker ── pausa con document.hidden para no gastar CPU en background */
  const [iaosIdx, setIaosIdx] = useState(0);
  useEffect(() => {
    let t = null;
    const start = () => { if (t == null) t = setInterval(() => setIaosIdx(i => (i + 1) % 4), 4000); };
    const stop  = () => { if (t != null) { clearInterval(t); t = null; } };
    const onVisibility = () => (document.hidden ? stop() : start());
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, []);

  /* ── MetaPanel state ── */
  const [metaOpen, setMetaOpen]     = useState(false);
  // El chat avisa cuando abre un canal en el celular: ahí la app esconde su
  // header y la barra de abajo y el hilo ocupa toda la pantalla, igual que el
  // Copilot (pedido de Ángel, 27-jul).
  const [chatInmersivo, setChatInmersivo] = useState(false);
  // El MetaPanel es una SECCIÓN dentro del contenido (deja header + menú a la vista),
  // no un overlay a pantalla completa. Al navegar a otra vista (cambia `v`) se cierra
  // solo, para que no quede tapando la vista nueva. Deps SOLO [v]: abrir el panel no
  // cambia `v`, así que no se auto-cierra al abrirlo.
  useEffect(() => { setMetaOpen(false); }, [v]);
  const [metaTab, setMetaTab]       = useState("acciones");
  const [metaActions, setMetaActions] = useState([]);
  const metaActionsSeeded = useRef(false);
  // Siembra la Lista de Acción con el MISMO universo que muestra el panel "Acciones del
  // Equipo": las acciones derivadas de cada lead con próxima acción (efímeras) + las que el
  // equipo crea a mano y se guardan en team_actions (persistidas, con su `done` real). Así el
  // widget de la barra lateral (ACT hechas/total y % de AVANCE) cuadra con lo que muestra el
  // panel. RLS filtra team_actions por el org del usuario. El panel vuelve a mergear al abrirse
  // (de-dup por id), así que esto solo adelanta el conteo para el widget.
  useEffect(() => {
    if (metaActionsSeeded.current || leadsData.length === 0) return;
    metaActionsSeeded.current = true;
    const derived = leadsData.filter(l => l.nextAction).map(l => ({
      id: l.id, text: l.nextAction, lead: l.n,
      asesor: (l.asesor || '').split(' ')[0], date: l.nextActionDate,
      done: false, priority: l.hot ? 'urgente' : l.daysInactive >= 7 ? 'alto' : 'normal',
      assignee: l.asesor, assigneeType: 'human',
    }));
    setMetaActions(derived);
    supabase.from("team_actions").select("*").order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error || !data) return;
        const mapped = data.map(r => ({
          id: r.id, text: r.text, lead: r.category || 'General', asesor: r.asesor_name || '',
          date: r.due_at ? new Date(r.due_at).toLocaleString('es-MX', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '',
          done: r.done, priority: r.priority || 'normal', assignee: r.asesor_name || '',
          assigneeType: r.assignee_type || 'human', due_at: r.due_at, _persisted: true,
        }));
        const ids = new Set(mapped.map(m => m.id));
        setMetaActions(prev => [...mapped, ...prev.filter(a => !a._persisted && !ids.has(a.id))]);
      });
  }, [leadsData]);
  const [metaNewText, setMetaNewText]   = useState("");
  const [doneCollapsed, setDoneCollapsed] = useState(true);
  const [metaPlan, setMetaPlan]         = useState(DEFAULT_META_PLAN);
  const [metaProtocol, setMetaProtocol] = useState(DEFAULT_META_PROTOCOL);

  // Configuración por organización (Plan, Protocolo, Goal).
  // Si la org tiene meta_config en DB → se usa (overrides los defaults).
  // Si meta_config es NULL → caemos a DEFAULT_META_* (compat legacy / Stratos = Duke).
  // Esto permite isolación total: Grupo 28 nunca ve contenido de Duke y viceversa.
  const [orgMetaConfig, setOrgMetaConfig] = useState(null);
  const [metaDocs, setMetaDocs] = useState([]);
  const metaCfgLoaded = useRef(false);   // evita escribir meta_config antes de saber qué hay en DB
  useEffect(() => {
    const orgId = user?.organizationId;
    if (!orgId || user?._offline || user?.id === 'demo-user-local') return;
    let cancelled = false;
    supabase
      .from('organizations')
      .select('meta_config, name')
      .eq('id', orgId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { console.warn('[Stratos] org meta_config fetch falló:', error.message); return; }
        if (data?.meta_config) setOrgMetaConfig({ ...data.meta_config, _orgName: data.name });
        setMetaDocs(Array.isArray(data?.meta_config?.documents) ? data.meta_config.documents : []);
        metaCfgLoaded.current = true;
      });
    return () => { cancelled = true; };
  }, [user?.organizationId, user?._offline, user?.id]);

  // Plan/Protocolo efectivos: lo de la org va ENCIMA del default, no en lugar de él.
  //
  // BUG que reportó Ángel con captura (27-jul): entrar a «Protocolo de Ventas»
  // reventaba la pantalla entera con «Cannot read properties of undefined
  // (reading 'map')». Causa: se le cargó a NSG un `protocol` con 3 claves
  // (stages, objections, qualification) y este memo lo usaba TAL CUAL, borrando
  // las otras ~15 que la pantalla recorre con .map (`principios`, `kpis`,
  // `slas`…). Una sola clave faltante tumbaba el módulo.
  //
  // El merge lo vuelve imposible: lo que la org define manda, lo que no define
  // cae al default. Guardar medio protocolo ya no puede romper nada.
  // [guard:META-MERGE-DEFAULTS]
  const effectiveMetaPlan = useMemo(
    () => (orgMetaConfig?.plan ? { ...metaPlan, ...orgMetaConfig.plan } : metaPlan),
    [orgMetaConfig, metaPlan]
  );
  const effectiveMetaProtocol = useMemo(
    () => (orgMetaConfig?.protocol ? { ...metaProtocol, ...orgMetaConfig.protocol } : metaProtocol),
    [orgMetaConfig, metaProtocol]
  );
  // Brand label: prioridad → meta_config.brand (override explícito en DB) →
  // legalName del cliente activo (config por URL) → "Duke del Caribe" como
  // último fallback. Esto reemplaza el check hardcoded "=== 'Grupo 28'"
  // por una resolución basada en el sistema multi-cliente, así cualquier
  // cliente futuro funciona sin tocar este archivo.
  const orgBrand = orgMetaConfig?.brand
                || clientConfig?.legalName
                || 'Duke del Caribe';

  // Setters envueltos: si la org tiene meta_config en DB, las ediciones
  // van a orgMetaConfig (con auto-save debounceado). Si no (Stratos legacy),
  // siguen yendo al estado local metaPlan/metaProtocol (compat).
  // Base para el updater: si la org tiene meta_config pero SIN la clave plan/protocol
  // (ej. Duke solo trae campaign_aliases), la primera edición debe partir de los
  // defaults en memoria — no de {} — o el updater truena al leer p.coreValues etc.
  const handleSetMetaPlan = useCallback((updater) => {
    if (orgMetaConfig) {
      setOrgMetaConfig(prev => {
        if (!prev) return prev;
        const nextPlan = typeof updater === 'function' ? updater(prev.plan ?? metaPlan) : updater;
        return { ...prev, plan: nextPlan, _dirty: true };
      });
    } else {
      setMetaPlan(updater);
    }
  }, [orgMetaConfig, metaPlan]);
  const handleSetMetaProtocol = useCallback((updater) => {
    if (orgMetaConfig) {
      setOrgMetaConfig(prev => {
        if (!prev) return prev;
        const nextProto = typeof updater === 'function' ? updater(prev.protocol ?? metaProtocol) : updater;
        return { ...prev, protocol: nextProto, _dirty: true };
      });
    } else {
      setMetaProtocol(updater);
    }
  }, [orgMetaConfig, metaProtocol]);

  // Documentos del equipo (links a Google Docs/Drive/Notion/etc) — viven en
  // meta_config.documents. Si la org ya tiene meta_config cargado viajan con el
  // auto-save debounceado (preserva las demás claves); si meta_config es NULL
  // (ej. Stratos Sales) se escribe directo solo con la clave documents.
  // RLS (organizations_update_meta) limita la escritura a super_admin/admin.
  const handleSetMetaDocs = useCallback((nextDocs) => {
    setMetaDocs(nextDocs);
    if (orgMetaConfig) {
      setOrgMetaConfig(prev => prev ? { ...prev, documents: nextDocs, _dirty: true } : prev);
      return;
    }
    const orgId = user?.organizationId;
    if (!orgId || user?._offline || user?.id === 'demo-user-local') return;
    // Solo escribimos meta_config completo si YA sabemos que en DB estaba NULL;
    // si el fetch inicial no ha vuelto, escribir {documents} pisaría plan/protocol.
    if (!metaCfgLoaded.current) return;
    supabase
      .from('organizations')
      .update({ meta_config: { documents: nextDocs } })
      .eq('id', orgId)
      .then(({ error }) => {
        if (error) console.warn('[Stratos] No se pudo guardar documentos:', error.message);
      });
  }, [orgMetaConfig, user?.organizationId, user?._offline, user?.id]);

  // Auto-save debounceado de la config de org. Espera 1.5s sin cambios y persiste.
  // RLS solo permite UPDATE a super_admin/admin de la misma org — si un asesor
  // intentara llamar a esto, Supabase devuelve error que ignoramos silenciosamente.
  useEffect(() => {
    if (!orgMetaConfig?._dirty) return;
    const orgId = user?.organizationId;
    if (!orgId || user?._offline) return;
    const t = setTimeout(async () => {
      const { _dirty, _orgName, ...cleanConfig } = orgMetaConfig;
      const { error } = await supabase
        .from('organizations')
        .update({ meta_config: cleanConfig })
        .eq('id', orgId);
      if (!error) {
        setOrgMetaConfig(prev => prev ? ({ ...prev, _dirty: false }) : prev);
      } else {
        console.warn('[Stratos] No se pudo guardar meta_config:', error.message);
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [orgMetaConfig, user?.organizationId, user?._offline]);

  /* ── Notifications ── */
  const onLogout = () => logout();

  useEffect(() => {
    if (!user) return;
    // Notificaciones REALES del Centro de Inteligencia a partir de los leads del CRM
    // (reemplaza los placeholders demo). Se recalculan cuando cambian los leads.
    setNotifs(buildIntelNotifs(leadsData));
  }, [user, leadsData]);

  // Marketing: su propio Centro de Inteligencia, desde el cerebro (fn_mkt_intel).
  // Se refresca al entrar y cada 5 minutos — no hace falta más: son tareas del
  // día, no un chat. Se corta cuando la pestaña está oculta (regla de perf).
  const esMkt = !!user && (user.role === "marketing" || user.isMarketingAdmin === true);
  useEffect(() => {
    if (!esMkt || !user?.id) { setMktIntel(null); return; }
    let vivo = true;
    const cargar = async () => {
      if (document.hidden) return;
      try {
        const { data } = await supabase.rpc("fn_mkt_intel", { p_profile_id: user.id });
        if (vivo && data?.ok) setMktIntel(data);
      } catch { /* si falla, la isla simplemente no muestra nada */ }
    };
    cargar();
    const t = setInterval(cargar, 300000);
    return () => { vivo = false; clearInterval(t); };
  }, [esMkt, user?.id]);

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

  // Gate de auth:
  //  · user presente → render normal de la app.
  //  · user null + bootHydrating → splash (estamos validando una sesión
  //    probable: hay JWT en localStorage pero la caché Stratos expiró).
  //    Esto evita el flash al LoginScreen que veía el usuario en cada F5.
  //  · user null + !bootHydrating → LoginScreen (sin sesión, login real).
  if (!user) {
    if (bootHydrating) {
      return (
        <div style={{
          position: "fixed", inset: 0, background: T.bg,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: 16,
          fontFamily: font, color: T.txt,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            border: `2px solid ${T.border}`,
            borderTopColor: T.accent,
            animation: "stratosSpin 0.9s linear infinite",
          }} />
          <div style={{
            fontSize: 12.5, letterSpacing: "0.08em", textTransform: "uppercase",
            color: T.txt2, fontWeight: 500,
          }}>
            {clientConfig?.brand?.appWordmark || "Stratos AI"}
          </div>
          <style>{`@keyframes stratosSpin { to { transform: rotate(360deg); } }`}</style>
        </div>
      );
    }
    return <LoginScreen onLogin={login} />;
  }

  /* ── Sidebar helpers ── */
  // GOAL viene de la organización si la tiene configurada; si no, el default Duke ($48M).
  // Si la org tiene goal=0 (placeholder Grupo 28) lo tratamos como sin configurar.
  const GOAL        = (effectiveMetaPlan?.goal && effectiveMetaPlan.goal > 0) ? effectiveMetaPlan.goal : 48_000_000;
  // ACT / AVANCE: mismas cuentas que el panel "Acciones del Equipo" (metaActions).
  // Solo acciones de equipo REALES (team_actions persistidas). Las derivadas de leads
  // (la "próxima acción" de cada lead) nunca se marcan hechas → inflaban el total y
  // dejaban el % pegado en 1. Estas SÍ se completan (checkbox o el coach del bot por Telegram).
  const realActions = metaActions.filter(a => a._persisted);
  const actDone     = realActions.filter(a => a.done).length;   // completadas
  const actTotal    = realActions.length;                       // total de acciones de equipo reales
  const pc          = Math.max(1, Math.min(100, actTotal ? Math.round((actDone / actTotal) * 100) : 1));   // % de avance

  // Sidebar: TODOS los módulos accesibles (rol + org). Se muestran los 5
  // primeros en la barra; el resto vive en un modal centrado "Aplicaciones".
  const accessibleAll = nav.filter(n =>
    n.id !== "wa"
    &&
    (!n.adminOnly || ["super_admin","admin"].includes(user?.role))
    && canAccessModule(n.id, user, clientConfig)
  );
  const sidebarTop  = accessibleAll.slice(0, 5);
  const hasMoreApps = accessibleAll.length > 5;
  const appsActive  = !metaOpen && (sidebarMore || !sidebarTop.some(n => n.id === v));

  const NavBtn = ({ n }) => {
    const a = n.id === "miespacio" ? metaOpen : (v === n.id && !metaOpen);
    const isAdmin = n.adminOnly;
    const hasAccess = canAccessModule(n.id, user, clientConfig);
    const mintC = isAdmin ? "#A78BFA" : "#6EE7C2";
    const activeColor = isAdmin ? "#A78BFA" : (isLight ? T.accent : mintC);
    const activeIcon  = isLight ? activeColor : (isAdmin ? "#ECE6FF" : "#E9FCF4");
    const iconSize = n.id === "d" ? 23 : n.id === "ia" ? 22 : n.id === "lp" ? 22 : n.id === "e" ? 21 : n.id === "c" ? 22 : 20;
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, width:56, padding:0 }}>
        <button
          onClick={() => { if (n.id === "miespacio") { setMetaOpen(true); setSidebarMore(false); return; } setV(n.id); setSidebarMore(false); setMetaOpen(false); }}
          title={(clientConfig?.navLabels?.[n.id] ?? n.l) + (!hasAccess ? " · Sin acceso" : "")}
          style={{
            width:48, height:40, borderRadius:14,
            padding:0, lineHeight:0,
            cursor: hasAccess ? "pointer" : "not-allowed",
            opacity: hasAccess ? 1 : 0.32,
            outline:"none",
            background: a ? (isLight ? "linear-gradient(180deg, rgba(255,255,255,0.86), rgba(248,250,252,0.68))" : "linear-gradient(180deg, rgba(255,255,255,0.065), rgba(110,231,194,0.022))") : "transparent",
            border: a ? (isLight ? "1px solid rgba(15,23,42,0.10)" : "1px solid rgba(190,245,225,0.16)") : "1px solid transparent",
            boxShadow: a ? (isLight ? "0 3px 10px rgba(15,23,42,0.06)" : "0 3px 10px rgba(0,0,0,0.24)") : "none",
            display:"flex", alignItems:"center", justifyContent:"center",
            transition:"background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease",
            position:"relative",
          }}
          onMouseEnter={e => { if (!a && hasAccess) { e.currentTarget.style.background = isLight ? "rgba(255,255,255,0.42)" : "rgba(255,255,255,0.045)"; e.currentTarget.style.borderColor = isLight ? "rgba(255,255,255,0.72)" : "rgba(190,245,225,0.09)"; } }}
          onMouseLeave={e => { if (!a) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.transform = "scale(1)"; } }}
          onMouseDown={e => { if (hasAccess) e.currentTarget.style.transform = "scale(0.95)"; }}
          onMouseUp={e => { if (hasAccess) e.currentTarget.style.transform = "scale(1)"; }}
        >
          {n.id === "copilot"
            ? <CopilotMark size={iconSize + 3} isLight={isLight} style={{ opacity: a ? 1 : (hasAccess ? 0.82 : 1) }} />
            : n.id === "miespacio" && n.i
            ? <n.i size={iconSize} strokeWidth={2} color={a ? activeIcon : (isLight ? "rgba(15,23,42,0.45)" : "rgba(255,255,255,0.40)")} />
            : <IosIcon name={n.id} filled={a} size={iconSize} color={a ? activeIcon : (isLight ? "rgba(15,23,42,0.45)" : "rgba(255,255,255,0.40)")} />}
        </button>
        <span style={{ width:"100%", fontSize:9, fontFamily:fontDisp, fontWeight: a ? 650 : 430, letterSpacing: a ? "0.01em" : "0.005em", textAlign:"center",
          color: a ? activeIcon : (isLight ? "rgba(15,23,42,0.38)" : "rgba(255,255,255,0.28)"),
          lineHeight:1, userSelect:"none", transition:"color 0.18s ease",
        }}>{clientConfig?.navLabels?.[n.id] ?? n.l}</span>
      </div>
    );
  };

  /* ─────────────────── render ─────────────────── */
  return (
    <div className="stratos-app" data-immersive={(v === "copilot" || v === "wa" || (v === "chat" && chatInmersivo)) ? "1" : undefined} style={{
      height:"100vh", display:"flex", fontFamily:font, color:T.txt,
      background: isLight
        // Lienzo Apple: gris frío neutro luminoso (desde tokens) + un tenue halo
        // de "luz desde arriba" en slate neutro (NO menta). Brand vive en acentos.
        ? `radial-gradient(1300px 880px at 50% -12%, rgba(148,163,196,0.07) 0%, rgba(148,163,196,0.022) 34%, transparent 60%),
           radial-gradient(1100px 760px at 50% 114%, rgba(100,116,150,0.045) 0%, transparent 58%),
           linear-gradient(180deg, ${T.bgSoft} 0%, ${T.bg} 52%, ${T.bgCool} 100%)`
        : `radial-gradient(1200px 600px at 30% -5%, rgba(80,120,255,0.025) 0%, transparent 55%), #030810`,
      transition:"background 0.3s ease, color 0.3s ease",
    }}>
      {/* ── Static CSS ── */}
      <style>{`
        /* ⚠️ NO PONER @import ACÁ. (Quitado 17-ago-2026.)
           Vivía acá un @import de Google Fonts (Outfit + Plus Jakarta Sans) que
           NADIE usaba: cero referencias a esas familias en todo src/ — se bajaban
           9 variantes de fuente en cada arranque para nada.
           Y un @import dentro de CSS es la peor forma de pedir algo: el navegador
           tiene que bajar y parsear ESTE <style> para recién ahí descubrir la URL
           y salir a Google — un viaje en cascada, no en paralelo — y mientras
           tanto frena el pintado. Medido en producción: se pedía a los 1.112 ms,
           en pleno arranque, cuando la pantalla todavía era el splash.
           Si algún día hace falta una fuente, va como <link> en index.html
           (no bloqueante), nunca como @import acá adentro. */
        .topbar-shimmer{background-size:300% 100%;animation:shimmer 2.4s linear infinite}
        .topbar-static{background-size:100%}
        .widget-shimmer{animation:pillShimmer 5s ease-in-out infinite}
        @keyframes blink{0%,100%{opacity:.25}50%{opacity:1}}
        @keyframes wave{from{transform:scaleY(.25)}to{transform:scaleY(1)}}
        @keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes atomSpin{from{transform:translateZ(0) rotate(0deg)}to{transform:translateZ(0) rotate(360deg)}}
        @keyframes stratosAtomSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes scanLine{0%{top:0}100%{top:100%}}
        @keyframes stepFade{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
        @keyframes modalIn{from{opacity:0;transform:translate(-50%,-50%) scale(0.97)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
        @keyframes pillBeamOnce{from{transform:translateX(-130%);opacity:0}22%{opacity:1}78%{opacity:1}to{transform:translateX(230%);opacity:0}}
        @keyframes iaosSlideIn{from{opacity:0;transform:translateX(-14px)}to{opacity:1;transform:translateX(0)}}
        *{box-sizing:border-box;margin:0}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:transparent}
        /* iOS Safari: 100vh mide el viewport SIN descontar la barra de URL →
           el borde inferior (composer del chat de WhatsApp, bottom nav) queda
           tapado por la barra. dvh sigue el viewport visible REAL y se ajusta
           cuando la barra aparece/desaparece. Navegador viejo sin dvh: ignora
           esta regla y sigue con el 100vh inline de siempre. */
        @supports (height: 100dvh){ .stratos-app{ height:100dvh!important } }
        .stratos-bottomnav{display:none}
        /* Safe areas (notch iPhone / status bar edge-to-edge): env() = 0 en
           navegadores normales, así que estas reglas solo actúan donde hace falta. */
        .stratos-header{height:calc(52px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))!important;padding-top:var(--safe-area-inset-top, env(safe-area-inset-top, 0px))!important}
        /* El DynIsland centrado es position:absolute (no reserva espacio): entre
           769-900px colisiona con la fila derecha → se oculta también ahí. */
        @media(max-width:900px){
          .stratos-header-center{display:none!important}
        }
        @media(max-width:768px){
          .stratos-sidebar{display:none!important}
          /* padding inferior = holgura sobre el nav (58px) + safe area (home
             indicator iPhone / gestos Android). overflow-x:hidden = clamp
             defensivo global: ninguna vista puede panear la página horizontal. */
          .stratos-content-area{padding:20px 16px calc(84px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))) 16px!important;overflow-x:hidden!important;overflow-anchor:none}
          /* Barra inferior DOCKEADA al borde de la pantalla (estilo Instagram /
             apps nativas de Apple): pegada a bottom:0, full-width, y el relleno
             del home-indicator (safe-area) lo pinta la PROPIA barra — nada de
             quedar "flotando" con aire abajo. Pedido de Ángel 2026-07-17. */
          .stratos-bottomnav{
            display:flex!important;position:fixed;left:0;right:0;bottom:0;
            z-index:200;align-items:stretch;justify-content:stretch;gap:0;
            padding:0;pointer-events:none;
          }
          .stratos-bottomnav > *{pointer-events:auto}
          /* COPILOT / WHATSAPP INMERSIVOS estilo WhatsApp (pedido de Ángel):
             se ocultan el header de la app Y la barra inferior → la vista ocupa
             TODA la pantalla; su propio header trae la flecha "‹ volver" + un
             número (score / nº de chats). Solo en móvil. */
          .stratos-app[data-immersive="1"] .stratos-header{display:none!important}
          .stratos-app[data-immersive="1"] .stratos-bottomnav{display:none!important}
          /* CLAVE: el content-area de móvil tiene padding !important (20px arriba
             + 84px abajo) que le GANABA al padding:0 inline del Copilot/WhatsApp
             → dejaba un hueco negro arriba y abajo (no llenaba la pantalla). En
             inmersivo el relleno es 0: la vista llega borde a borde. */
          .stratos-app[data-immersive="1"] .stratos-content-area{padding:0!important}
          .stratos-header{padding-left:10px!important;padding-right:10px!important;gap:6px!important}
          .stratos-header-left{gap:6px!important;min-width:0!important;flex:1 1 auto!important;overflow:hidden!important}
          .stratos-header-right{gap:2px!important;flex-shrink:0!important}
          /* El Centro de Inteligencia (DynIsland) SÍ va centrado en móvil (rótulo "Inteligencia" para Duke). */
          .stratos-header-center{display:block!important}
          .stratos-header-search{display:none!important}
          /* El 📞 Llamar SIEMPRE por encima y tapeable: la pill del centro es
             absolute y (con rótulos largos) puede pintarse encima del botón —
             pasó en NSG. Elevarlo garantiza que el tap le llegue al botón. */
          .stratos-header-call{flex-shrink:0!important;position:relative!important;z-index:6!important}
          .stratos-header-divider{display:none!important}
          .stratos-header-phone{display:none!important}
          .stratos-userpill{padding:0!important;gap:0!important}
          .stratos-userpill-text{display:none!important}
          /* Wordmark truncable (tenants con nombre largo no rompen el header) */
          .stratos-wordmark{max-width:110px!important;overflow:hidden!important;text-overflow:ellipsis!important}
          /* En móvil la pill IAOS del header se OCULTA por completo: el acceso al
             Centro de Inteligencia ("Inteligencia") vive centrado (DynIsland). */
          .stratos-iaos-pill{display:none!important}
          /* Dropdown de la campanita: a lo ancho de la pantalla (antes width
             fija 300px anclada a la campana → se salía por la izquierda). */
          .stratos-bell-dropdown{position:fixed!important;top:calc(60px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))!important;left:10px!important;right:10px!important;width:auto!important;max-height:calc(100dvh - 150px)!important;overflow-y:auto!important}
        }
        /* ─── [guard:FORCE-MOBILE] Shell móvil forzado ───────────────────────────
           Un iPhone puede reportar ancho de ESCRITORIO (>768) por Safari "sitio
           para computadora", un <meta viewport> viejo cacheado (iOS → 980px) o
           zoom 50% → el @media(max-width:768px) de arriba NO matchea y la app
           mostraba el layout de ESCRITORIO en un celular (le pasó a Iván). El
           boot de index.html detecta el HARDWARE de teléfono (táctil + pantalla
           física ≤500px) y marca html[data-force-mobile="1"]; acá REPLICAMOS el
           shell móvil aunque el @media no haya matcheado. NO toca el bloque
           @media de arriba → teléfonos sanos en vertical y PC quedan idénticos.
           MANTENER EN SYNC con el @media(max-width:768px) de arriba. */
        html[data-force-mobile="1"] .stratos-sidebar{display:none!important}
        html[data-force-mobile="1"] .stratos-content-area{padding:20px 16px calc(84px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))) 16px!important;overflow-x:hidden!important;overflow-anchor:none}
        html[data-force-mobile="1"] .stratos-bottomnav{display:flex!important;position:fixed;left:0;right:0;bottom:0;z-index:200;align-items:stretch;justify-content:stretch;gap:0;padding:0;pointer-events:none}
        html[data-force-mobile="1"] .stratos-bottomnav > *{pointer-events:auto}
        html[data-force-mobile="1"] .stratos-app[data-immersive="1"] .stratos-header{display:none!important}
        html[data-force-mobile="1"] .stratos-app[data-immersive="1"] .stratos-bottomnav{display:none!important}
        html[data-force-mobile="1"] .stratos-app[data-immersive="1"] .stratos-content-area{padding:0!important}
        html[data-force-mobile="1"] .stratos-header{padding-left:10px!important;padding-right:10px!important;gap:6px!important}
        html[data-force-mobile="1"] .stratos-header-left{gap:6px!important;min-width:0!important;flex:1 1 auto!important;overflow:hidden!important}
        html[data-force-mobile="1"] .stratos-header-right{gap:2px!important;flex-shrink:0!important}
        html[data-force-mobile="1"] .stratos-header-center{display:block!important}
        html[data-force-mobile="1"] .stratos-header-search{display:none!important}
        html[data-force-mobile="1"] .stratos-header-call{flex-shrink:0!important;position:relative!important;z-index:6!important}
        html[data-force-mobile="1"] .stratos-header-divider{display:none!important}
        html[data-force-mobile="1"] .stratos-header-phone{display:none!important}
        html[data-force-mobile="1"] .stratos-userpill{padding:0!important;gap:0!important}
        html[data-force-mobile="1"] .stratos-userpill-text{display:none!important}
        html[data-force-mobile="1"] .stratos-wordmark{max-width:110px!important;overflow:hidden!important;text-overflow:ellipsis!important}
        html[data-force-mobile="1"] .stratos-iaos-pill{display:none!important}
        html[data-force-mobile="1"] .stratos-bell-dropdown{position:fixed!important;top:calc(60px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))!important;left:10px!important;right:10px!important;width:auto!important;max-height:calc(100dvh - 150px)!important;overflow-y:auto!important}
        /* En pantallas MUY angostas el toggle de tema se va (se cambia desde
           Perfil); la campana/avatar/salir siempre quedan. */
        @media(max-width:430px){
          .stratos-theme-toggle{display:none!important}
        }
      `}</style>
      <style>{dynamicStyles}</style>

      {/* El banner full-width fue reemplazado por el dropdown de la campana
          de notificaciones — vive en el header y solo es visible para roles
          administrativos cuando hay cambios pendientes o estamos offline. */}

      {/* ══ SIDEBAR ══ */}
      <div className="stratos-sidebar" style={{
        width:72, flexShrink:0, zIndex:10,
        borderRight:`1px solid ${isLight ? "rgba(15,23,42,0.08)" : "rgba(190,245,225,0.075)"}`,
        display:"flex", flexDirection:"column", alignItems:"center",
        paddingTop:0, paddingBottom:0, position:"relative", overflow:"hidden",
        background: isLight ? "linear-gradient(180deg, rgba(253,253,255,0.82), rgba(249,250,252,0.64))" : "linear-gradient(180deg, rgba(14,20,32,0.66), rgba(2,4,11,0.58))",
        backdropFilter:"blur(30px) saturate(165%)", WebkitBackdropFilter:"blur(30px) saturate(165%)",
        transition:"background 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease",
        boxShadow: isLight ? "4px 0 18px rgba(15,23,42,0.035)" : "6px 0 22px rgba(0,0,0,0.22)",
      }}>
        {/* TOP: Atom identity */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", paddingTop:11, paddingBottom:10, flexShrink:0, gap:6 }}>
          <div data-brand-motion="true" style={{
            willChange:"transform",
            transformOrigin:"center",
            position:"relative",
            width:30,
            height:30,
            display:"flex",
            alignItems:"center",
            justifyContent:"center",
            backfaceVisibility:"hidden",
            filter: isLight ? "drop-shadow(0 0 5px rgba(13,154,118,0.45)) drop-shadow(0 0 12px rgba(52,211,153,0.18))" : "drop-shadow(0 0 4px rgba(255,255,255,0.40)) drop-shadow(0 0 10px rgba(255,255,255,0.10))",
          }}>
            <StratosAtomHex size={30} color={isLight ? "#0D9A76" : "#FFFFFF"} edge={isLight ? "#34D399" : "#C8DED8"} motion />
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
            <div style={{ width:4, height:4, borderRadius:"50%", background:"#34D399", boxShadow:"0 0 5px rgba(52,211,153,0.80), 0 0 10px rgba(52,211,153,0.30)", animation:"pulse 2.2s ease-in-out infinite", willChange:"transform, opacity" }} />
            <span style={{ fontSize:8.5, fontFamily:fontDisp, fontWeight:500, letterSpacing:"0.18em", textTransform:"uppercase", color: isLight ? "rgba(15,23,42,0.32)" : "rgba(255,255,255,0.28)", lineHeight:1 }}>Live</span>
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
              border: metaOpen ? (isLight ? "1.5px solid rgba(13,154,118,0.55)" : "1.5px solid rgba(110,231,194,0.5)") : (isLight ? "1px solid rgba(255,255,255,0.92)" : "1px solid rgba(110,231,194,0.17)"),
              boxShadow: isLight
                ? (metaOpen ? "0 0 0 3px rgba(13,154,118,0.14), inset 0 1.5px 0 rgba(255,255,255,1), 0 6px 28px rgba(13,154,118,0.18)" : "inset 0 1.5px 0 rgba(255,255,255,1), 0 6px 28px rgba(13,154,118,0.10)")
                : (metaOpen ? "0 0 0 3px rgba(110,231,194,0.18), inset 0 1px 0 rgba(198,251,238,0.09), 0 14px 40px rgba(0,0,0,0.55)" : ["inset 0 1px 0 rgba(198,251,238,0.09)","inset 0 -1px 0 rgba(0,0,0,0.30)","0 14px 40px rgba(0,0,0,0.55)"].join(", ")),
              padding:"11px 9px 12px",
            }}>
              <div style={{ position:"absolute", top:0, left:0, right:0, height:"45%", background: isLight ? "linear-gradient(180deg, rgba(255,255,255,0.65) 0%, transparent 100%)" : "linear-gradient(180deg, rgba(52,211,153,0.07) 0%, transparent 100%)", pointerEvents:"none", borderRadius:"20px 20px 0 0" }} />
              {isLight && <div className="widget-shimmer" style={{ position:"absolute", top:0, bottom:0, left:0, width:"60%", background:"linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.07) 50%, transparent 100%)", pointerEvents:"none" }} />}
              <div style={{ position:"absolute", bottom:-6, left:"50%", transform:"translateX(-50%)", width:72, height:40, background: isLight ? "radial-gradient(ellipse, rgba(13,154,118,0.18) 0%, transparent 70%)" : "radial-gradient(ellipse, rgba(52,211,153,0.12) 0%, transparent 70%)", filter:"blur(12px)", pointerEvents:"none" }} />
              <div style={{ display:"flex", justifyContent:"center", position:"relative", zIndex:1, marginBottom:8 }}>
                {/* Solo los números, SIN píldora gris detrás (Iván 29-jul: «quita la
                    cosa gris… nada más deja los números»). Centrados, sin cortes. */}
                <span style={{ fontSize:9, fontFamily:fontDisp, fontWeight:400, letterSpacing:"-0.01em", fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap", color: isLight ? "rgba(15,23,42,0.66)" : "rgba(255,255,255,0.62)" }}>{actDone}/{actTotal}</span>
              </div>
              {/* El número del avance, centrado de verdad. Con un solo dígito («1»)
                  se veía corrido a la izquierda: `letterSpacing` negativo agrega
                  el espacio DESPUÉS del último caracter, y con dos o tres dígitos
                  eso se compensa entre ellos pero con uno queda todo al final.
                  Por eso el apretado tipográfico solo se aplica cuando hay más de
                  un dígito, y el bloque se centra explícitamente.
                  Además el TAMAÑO se ajusta a cuántos dígitos hay (Iván, 29-jul:
                  «que se ajuste dinámicamente para que se vea bien»): con uno solo
                  hay lugar de sobra y respira mejor un poco más grande. */}
              {(() => {
                const pcTxt = pc >= 100 ? "✓" : String(pc);
                const tam = pcTxt === "✓" ? 30 : pcTxt.length >= 3 ? 27 : pcTxt.length === 2 ? 33 : 35;
                return (
                  <span style={{
                    fontSize: tam, fontWeight: pc >= 100 ? 400 : 200, fontFamily: fontDisp,
                    letterSpacing: pcTxt.length >= 2 ? "-0.04em" : "0", lineHeight: 1,
                    color: isLight ? (pc >= 100 ? "#0D9A76" : "#082818") : (pc >= 100 ? "#34D399" : "#FFFFFF"),
                    display: "block", textAlign: "center", width: "100%",
                    position: "relative", zIndex: 1, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums",
                  }}>{pcTxt}</span>
                );
              })()}
              <div style={{ width:"100%", height:2.5, borderRadius:99, background: isLight ? "rgba(13,154,118,0.09)" : "rgba(255,255,255,0.08)", marginTop:9, overflow:"hidden", position:"relative", zIndex:1 }}>
                <div style={{ width:`${pc}%`, height:"100%", borderRadius:99, background: isLight ? "linear-gradient(90deg, #0D9A76, #34D399)" : "linear-gradient(90deg, #34D399, #6EE7C2)", boxShadow: isLight ? "none" : "0 0 8px rgba(52,211,153,0.55)", transition:"width 1.1s cubic-bezier(0.4,0,0.2,1)" }} />
              </div>
              {/* Una sola palabra: en el riel de 58px «Mi Espacio» partía en dos
                  renglones (Iván, 31-jul: «que quepa en un solo renglón»). */}
              <span style={{ fontSize:7, fontWeight:500, fontFamily:fontDisp, letterSpacing:"0.08em", textTransform:"uppercase", textAlign:"center", lineHeight:1.5, whiteSpace:"nowrap", color: isLight ? "rgba(13,154,118,0.48)" : "rgba(52,211,153,0.36)", display:"block", marginTop:8, position:"relative", zIndex:1 }}>Espacio</span>
            </div>
            <div style={{ width:32, height:1, marginTop:10, background: isLight ? "linear-gradient(90deg, transparent, rgba(15,23,42,0.07), transparent)" : "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }} />
          </div>

          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, width:58, padding:"5px 0", borderRadius:19, background: isLight ? "linear-gradient(180deg, rgba(255,255,255,0.58), rgba(255,255,255,0.40))" : "linear-gradient(180deg, rgba(16,22,30,0.50) 0%, rgba(5,8,13,0.60) 100%)", backdropFilter:"blur(26px) saturate(185%)", WebkitBackdropFilter:"blur(26px) saturate(185%)", border: isLight ? "1px solid rgba(255,255,255,0.92)" : "1px solid rgba(255,255,255,0.07)", boxShadow: isLight ? "inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(15,23,42,0.04), 0 10px 30px rgba(15,23,42,0.10)" : "inset 0 1px 0 rgba(190,245,225,0.09), inset 0 -1px 0 rgba(0,0,0,0.30), inset 0 0 24px rgba(0,0,0,0.22), 0 18px 44px rgba(0,0,0,0.55)" }}>
          {sidebarTop.map(n => <NavBtn key={n.id} n={n} />)}

          {hasMoreApps && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2, marginTop:2, width:54, padding:0 }}>
            <div style={{ height:1, width:32, background: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.05)" }} />
            <button onClick={() => setSidebarMore(true)} title="Todas las apps"
              style={{ width:46, height:38, borderRadius:13, padding:0, lineHeight:0, border: appsActive ? (isLight ? "1px solid rgba(255,255,255,0.92)" : "1px solid rgba(190,245,225,0.14)") : "1px solid transparent", background: appsActive ? (isLight ? "linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,255,255,0.50))" : "rgba(255,255,255,0.05)") : "transparent", boxShadow: appsActive && isLight ? "inset 0 1px 0 rgba(255,255,255,0.95), 0 1px 8px rgba(15,23,42,0.055)" : "none", backdropFilter: appsActive ? "blur(18px) saturate(180%)" : "none", WebkitBackdropFilter: appsActive ? "blur(18px) saturate(180%)" : "none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"background 0.18s ease, border-color 0.18s ease, transform 0.15s ease" }}
              onMouseEnter={e => { if(!appsActive){ e.currentTarget.style.background = isLight ? "rgba(255,255,255,0.42)" : "rgba(255,255,255,0.045)"; e.currentTarget.style.borderColor = isLight ? "rgba(255,255,255,0.72)" : "rgba(190,245,225,0.09)"; } }}
              onMouseLeave={e => { e.currentTarget.style.background = appsActive ? (isLight ? "linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,255,255,0.50))" : "rgba(255,255,255,0.05)") : "transparent"; e.currentTarget.style.borderColor = appsActive ? (isLight ? "rgba(255,255,255,0.92)" : "rgba(190,245,225,0.14)") : "transparent"; }}
            >
              <IosIcon name="menu" filled={appsActive} size={19} color={appsActive ? (isLight ? T.accent : "#E9FCF4") : (isLight ? "rgba(15,23,42,0.45)" : "rgba(255,255,255,0.40)")} />
            </button>
            <span style={{ fontSize:9, fontFamily:fontDisp, fontWeight: appsActive ? 650 : 430, letterSpacing:"0.01em", userSelect:"none", color: appsActive ? (isLight ? T.accent : "#E9FCF4") : (isLight ? "rgba(15,23,42,0.38)" : "rgba(255,255,255,0.28)"), transition:"color 0.18s ease" }}>Apps</span>
          </div>
          )}
          </div>
        </div>

        {/* Bottom: System button */}
        <div style={{ width:"100%", display:"flex", flexDirection:"column", alignItems:"center", paddingBottom:12 }}>
          <div style={{ height:1, width:34, background: isLight ? "rgba(13,154,118,0.10)" : "rgba(255,255,255,0.06)", margin:"4px auto 8px" }} />
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
            <button title={canAccessModule("admin", user, clientConfig) ? "Gestión de Usuarios" : "System — contraseña y soporte"}
              onClick={() => { setMetaOpen(false); canAccessModule("admin", user, clientConfig) ? setV("admin") : setV("perfil"); }}
              style={{
                width:44, height:44, borderRadius:13, cursor:"pointer",
                background: v==="admin"
                  ? "rgba(167,139,250,0.14)"
                  : v==="perfil"
                    ? (isLight ? `${T.accent}14` : "rgba(110,231,194,0.10)")
                    : (isLight ? "rgba(255,255,255,0.62)" : "rgba(255,255,255,0.038)"),
                border: v==="admin"
                  ? "1px solid rgba(167,139,250,0.28)"
                  : v==="perfil"
                    ? `1px solid ${T.accent}40`
                    : `1px solid ${isLight ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.06)"}`,
                backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)",
                display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow: isLight ? "inset 0 1px 0 rgba(255,255,255,0.72), 0 1px 2px rgba(15,23,42,0.04)" : "inset 0 1px 0 rgba(255,255,255,0.05)",
                transition:"all 0.22s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = isLight ? `${T.accent}10` : "rgba(255,255,255,0.08)"; e.currentTarget.style.transform="scale(1.08)"; }}
              onMouseLeave={e => {
                e.currentTarget.style.background = v==="admin"
                  ? "rgba(167,139,250,0.14)"
                  : v==="perfil"
                    ? (isLight ? `${T.accent}14` : "rgba(110,231,194,0.10)")
                    : (isLight ? "rgba(255,255,255,0.62)" : "rgba(255,255,255,0.038)");
                e.currentTarget.style.transform="scale(1)";
              }}
            >
              <Settings size={17} color={v==="admin" ? "#A78BFA" : v==="perfil" ? T.accent : (isLight ? T.txt2 : "rgba(255,255,255,0.34)")} strokeWidth={1.9} />
            </button>
            {/* El botón lleva a DOS lugares distintos según el rol, así que el
                nombre tiene que decir a cuál. Antes decía siempre «System» y a
                quien no es administrador lo mandaba a su Perfil: dos nombres
                para la misma pantalla, y encima el nombre interno nuestro. */}
            <span style={{ fontSize:9, fontFamily:font, fontWeight:500, color: isLight ? T.txt3 : "rgba(255,255,255,0.22)", userSelect:"none" }}>
              {canAccessModule("admin", user, clientConfig) ? "Usuarios" : "Perfil"}
            </span>
          </div>
        </div>
      </div>

      {/* ══ MAIN ══ */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
        {/* HEADER */}
        {(() => {
          const hBg = isLight ? "linear-gradient(180deg,rgba(255,255,255,0.82) 0%,rgba(249,250,252,0.70) 100%)" : "linear-gradient(180deg, rgba(7,12,22,0.72) 0%, rgba(2,5,14,0.60) 100%)";
          const hBorder = isLight ? "rgba(13,154,118,0.10)" : "rgba(255,255,255,0.06)";
          const iBtnBase = { width:32, height:32, borderRadius:8, border:"none", background:"transparent", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.14s ease" };
          const iBtnHoverBg  = isLight ? `${T.accent}0D` : "rgba(255,255,255,0.07)";
          const iBtnActiveBg = isLight ? `${T.accent}18` : "rgba(255,255,255,0.12)";
          const icoRest  = isLight ? T.txt3  : "rgba(255,255,255,0.40)";
          const hDiv = <div className="stratos-header-divider" style={{ width:1, height:16, flexShrink:0, background: isLight ? `${T.accent}22` : "rgba(255,255,255,0.07)", margin:"0 2px" }} />;
          const onIco  = e => { e.currentTarget.style.background = iBtnHoverBg; };
          const offIco = e => { e.currentTarget.style.background = "transparent"; };
          const dnIco  = e => { e.currentTarget.style.background = iBtnActiveBg; e.currentTarget.style.transform="scale(0.92)"; };
          const upIco  = e => { e.currentTarget.style.background = iBtnHoverBg;  e.currentTarget.style.transform="scale(1)"; };
          return (
            <div className="stratos-header" style={{ position:"relative", flexShrink:0, padding:"0 20px", height:52, borderBottom:`1px solid ${hBorder}`, display:"flex", justifyContent:"space-between", alignItems:"center", background:hBg, backdropFilter: "blur(24px) saturate(170%)", WebkitBackdropFilter: "blur(24px) saturate(170%)", boxShadow: isLight ? "0 2px 16px rgba(15,23,42,0.05)" : "0 3px 20px rgba(0,0,0,0.30)", transition:"background 0.3s ease" }}>
              {/* LEFT */}
              <div className="stratos-header-left" style={{ display:"flex", alignItems:"center", gap:10 }}>
                <p className="stratos-wordmark" style={{ margin:0, fontSize:14, fontFamily:fontDisp, letterSpacing:"-0.030em", fontWeight:400, color: isLight ? T.txt : "#FFFFFF", lineHeight:1, whiteSpace:"nowrap" }}>
                  {clientConfig?.brand?.appWordmark
                    ? clientConfig.brand.appWordmark
                    : <>Stratos<span style={{ marginLeft:3, fontWeight:400, color: isLight ? "rgba(15,23,42,0.38)" : "rgba(255,255,255,0.30)", letterSpacing:"0.01em" }}>AI</span></>}
                </p>
                {hasCRM && <IAOSIsland leadsData={leadsData} isLight={isLight} idx={iaosIdx} brandLabel={orgBrand} onOpen={() => setIntelOpenTick(t => t + 1)} />}
                {!hasCRM && esMkt && mktIntel && <IAOSIsland isLight={isLight} idx={iaosIdx} brandLabel={orgBrand} phrases={buildMktIntelPhrases(mktIntel, orgBrand)} onOpen={() => setIntelOpenTick(t => t + 1)} />}
              </div>
              {/* CENTER */}
              <div className="stratos-header-center" style={{ position:"absolute", left:"50%", transform:"translateX(-50%)" }}>
                {hasCRM && <DynIsland onExpand={openPriorityLead} onOpenLead={openLeadExpediente} notifications={notifs} theme={theme} beamIdx={iaosIdx} openSignal={intelOpenTick} />}
                {!hasCRM && esMkt && mktIntel && <DynIsland notifications={buildMktIntelNotifs(mktIntel)} theme={theme} beamIdx={iaosIdx} openSignal={intelOpenTick} />}
              </div>
              {/* RIGHT */}
              <div className="stratos-header-right" style={{ display:"flex", alignItems:"center", gap:4 }}>
                {clientConfig?.features?.crm !== false && (
                <button className="stratos-header-search" title="Buscar (⌘K)" onClick={openHeaderSearch} style={iBtnBase} onMouseEnter={onIco} onMouseLeave={offIco} onMouseDown={dnIco} onMouseUp={upIco}>
                  <IosIcon name="search" size={16} color={icoRest} />
                </button>
                )}
                {/* ── Botón "Llamar" (tenants con features.reunionButton, hoy NSG) ──
                   Un toque: la RPC fn_start_team_call avisa a los compañeros de la
                   org ("📞 X te está llamando" → campanita + push al teléfono) y
                   dispara la grabación de tl;dv (webhook secreto vive en la DB);
                   acá solo abrimos el Meet que devuelve. Si la RPC falla, se abre
                   la sala fija igual (la llamada nunca se bloquea por un aviso). */}
                {clientConfig?.features?.reunionButton && (
                  <div style={{ position: "relative" }}>
                    {/* Clase PROPIA (no stratos-header-search, que el CSS oculta en
                        móvil) → el 📞 se ve en PC y en el celular. */}
                    <button
                      className="stratos-header-call"
                      title="Llamar a un compañero — le suena en el teléfono, graba la reunión y abre el Meet"
                      onClick={openCallMenu}
                      style={iBtnBase} onMouseEnter={onIco} onMouseLeave={offIco} onMouseDown={dnIco} onMouseUp={upIco}
                    >
                      <PhoneCall size={16} color={icoRest} />
                    </button>
                    {callOpen && createPortal(
                      <>
                        <div onClick={() => setCallOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 99980 }} />
                        <div style={{ position: "fixed", top: 56, right: 14, zIndex: 99981, minWidth: 236, borderRadius: 14, padding: 6, background: "rgba(8,13,22,0.98)", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 18px 44px rgba(0,0,0,0.5)" }}>
                          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(255,255,255,0.45)", padding: "8px 10px 6px" }}>LLAMAR A…</div>
                          {callTargets === null && (
                            <div style={{ padding: "8px 10px", fontSize: 12.5, color: "rgba(255,255,255,0.6)" }}>Cargando equipo…</div>
                          )}
                          {Array.isArray(callTargets) && callTargets.map(t => (
                            <button key={t.id} onClick={() => startTeamCall(t.id)}
                              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "10px 10px", borderRadius: 10, border: "none", background: "transparent", color: P.txt, fontSize: 13.5, cursor: "pointer" }}>
                              <PhoneCall size={14} color={P.accent} /> {t.name}
                            </button>
                          ))}
                          {Array.isArray(callTargets) && callTargets.length === 0 && (
                            <div style={{ padding: "8px 10px", fontSize: 12.5, color: "rgba(255,255,255,0.6)" }}>No hay compañeros con acceso todavía.</div>
                          )}
                          <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "4px 8px" }} />
                          <button onClick={() => startTeamCall(null)}
                            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "10px 10px", borderRadius: 10, border: "none", background: "transparent", color: P.txt, fontSize: 13.5, cursor: "pointer" }}>
                            <PhoneCall size={14} color={P.accent} /> Llamada grupal (todo el equipo)
                          </button>
                        </div>
                      </>, document.body)}
                  </div>
                )}
                {/* ── Campana de notificaciones ──
                   Cuando hay cambios pendientes de sincronizar (modo offline
                   o cola residual), la campana muestra un badge ámbar con la
                   cuenta y abre un dropdown con acciones. Para el resto de
                   usuarios sigue siendo solo el icono. */}
                <div ref={bellRef} style={{ position:"relative" }}>
                  <button
                    title={
                      totalNotifUnread > 0
                        /* El plural NO se arma pegando "es": «notificación» pierde
                           la tilde al pasar a plural, y salía «notificaciónes». */
                        ? `${totalNotifUnread} ${totalNotifUnread !== 1 ? "notificaciones" : "notificación"} sin leer`
                        : pendingSync > 0
                          ? `${pendingSync} cambios pendientes de sincronizar`
                          : "Notificaciones"
                    }
                    onClick={() => setBellOpen(o => !o)}
                    style={{ ...iBtnBase, position:"relative" }}
                    onMouseEnter={onIco}
                    onMouseLeave={offIco}
                    onMouseDown={dnIco}
                    onMouseUp={upIco}
                  >
                    <IosIcon name="bell" size={16} color={icoRest} />
                    {totalNotifUnread > 0 ? (
                      /* WhatsApp o Copilot sin leer mandan verde. */
                      <div style={{
                        position:"absolute", top:-2, right:-2,
                        minWidth:14, height:14, padding:"0 3.5px", borderRadius:99,
                        background:T.accent, color:"#041016",
                        border:`1.5px solid ${isLight ? "#F5FAF8" : "#050507"}`,
                        fontSize:10, fontWeight:500, fontFamily:fontDisp,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        lineHeight:1,
                      }}>{totalNotifUnread > 99 ? "99+" : totalNotifUnread}</div>
                    ) : pendingSync > 0 ? (
                      <div style={{
                        position:"absolute", top:-2, right:-2,
                        minWidth:14, height:14, padding:"0 3.5px", borderRadius:99,
                        background:"#F59E0B", color:"#0B1220",
                        border:`1.5px solid ${isLight ? "#F5FAF8" : "#050507"}`,
                        fontSize:10, fontWeight:500, fontFamily:fontDisp,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        lineHeight:1,
                      }}>{pendingSync > 99 ? "99+" : pendingSync}</div>
                    ) : (
                      <div style={{ position:"absolute", top:6, right:6, width:5, height:5, borderRadius:"50%", background:T.rose, border:`1.5px solid ${isLight ? "#F5FAF8" : "#050507"}` }} />
                    )}
                  </button>

                  {bellOpen && createPortal((() => {
                    // Anclamos el panel a la campana pero lo renderizamos en <body>
                    // (portal). Antes vivía DENTRO del header, que tiene
                    // backdrop-filter → creaba un stacking context propio y el panel
                    // se "sobreponía" feo con los botones/KPIs de abajo (y en Safari
                    // se mezclaba). Fixed a viewport + fondo OPACO = flota limpio y
                    // por encima de todo, sin pisar el layout.
                    const r = bellRef.current?.getBoundingClientRect();
                    const ddTop   = r ? Math.round(r.bottom + 8) : 58;
                    const ddRight = r ? Math.max(8, Math.round(window.innerWidth - r.right)) : 14;
                    return (
                    <>
                      {/* Overlay para cerrar el dropdown clickeando fuera */}
                      <div onClick={() => setBellOpen(false)} style={{ position:"fixed", inset:0, zIndex:99990 }} />
                      {/* className: en móvil el CSS global lo vuelve full-width fijo. */}
                      <div className="stratos-bell-dropdown" style={{
                        position:"fixed", top:ddTop, right:ddRight, zIndex:99991,
                        width:300, padding:14, borderRadius:14,
                        background: isLight ? "#FFFFFF" : "#0C1220",
                        border:`1px solid ${isLight ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.10)"}`,
                        boxShadow: isLight ? "0 18px 48px rgba(15,23,42,0.20)" : "0 20px 56px rgba(0,0,0,0.66)",
                        display:"flex", flexDirection:"column", gap:10,
                      }}>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                          <span style={{ fontSize:12, fontWeight:500, letterSpacing:"0.06em", textTransform:"uppercase", color:isLight ? T.txt2 : "rgba(255,255,255,0.55)", fontFamily:fontDisp }}>Notificaciones</span>
                        </div>

                        {/* ── WhatsApp: clientes que escribieron y siguen sin leer ── */}
                        {waEnabled && waUnread > 0 && (
                          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                              <MessageCircle size={12} color={T.accent} strokeWidth={2.4} />
                              <span style={{ fontSize:11.5, fontWeight:500, letterSpacing:"0.04em", textTransform:"uppercase", color:T.accent, fontFamily:fontDisp }}>
                                WhatsApp · {waUnread} sin leer
                              </span>
                            </div>
                            {waInbox.unreadConversations.slice(0, 6).map(c => {
                              const u = Number(c.unread_count || 0);
                              return (
                                <button
                                  key={c.lead_id}
                                  onClick={() => openWaConversation(c.lead_id)}
                                  style={{
                                    display:"flex", alignItems:"center", gap:9, textAlign:"left",
                                    padding:"8px 9px", borderRadius:9, cursor:"pointer", width:"100%",
                                    background: isLight ? "rgba(13,154,118,0.06)" : "rgba(110,231,194,0.06)",
                                    border:`1px solid ${isLight ? "rgba(13,154,118,0.22)" : "rgba(110,231,194,0.18)"}`,
                                    transition:"background 0.14s",
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.background = isLight ? "rgba(13,154,118,0.11)" : "rgba(110,231,194,0.11)"; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = isLight ? "rgba(13,154,118,0.06)" : "rgba(110,231,194,0.06)"; }}
                                >
                                  <div style={{ flex:1, minWidth:0 }}>
                                    <div style={{ fontSize:12.5, fontWeight:500, color:T.txt, fontFamily:fontDisp, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                                      {c.lead_name || c.lead_phone || "Cliente"}
                                    </div>
                                    <div style={{ fontSize:11.5, color:isLight ? T.txt2 : "rgba(255,255,255,0.55)", fontFamily:font, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                                      {c.last_content || "Nuevo mensaje"}
                                    </div>
                                  </div>
                                  <span style={{
                                    minWidth:16, height:16, padding:"0 5px", borderRadius:99, flexShrink:0,
                                    background:T.accent, color:"#041016",
                                    fontSize:10.5, fontWeight:500, fontFamily:fontDisp,
                                    display:"flex", alignItems:"center", justifyContent:"center",
                                  }}>{u > 99 ? "99+" : u}</span>
                                </button>
                              );
                            })}
                            <button
                              onClick={() => { setV("wa"); setWaOpenLead(null); setBellOpen(false); }}
                              style={{
                                marginTop:2, padding:"6px 0", borderRadius:7, cursor:"pointer",
                                background:"transparent", border:"none",
                                color:T.accent, fontSize:12, fontWeight:500, fontFamily:font,
                              }}
                            >Ver todas las conversaciones →</button>
                          </div>
                        )}

                        {/* ── Copilot: nuevas respuestas del asistente IA ── */}
                        {copilotEnabled && copilotUnread > 0 && (
                          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                              <CopilotMark size={15} isLight={isLight} />
                              <span style={{ fontSize:11.5, fontWeight:500, letterSpacing:"0.04em", textTransform:"uppercase", color:T.accent, fontFamily:fontDisp }}>
                                Copilot · {copilotUnread} nueva{copilotUnread !== 1 ? "s" : ""}
                              </span>
                            </div>
                            <button
                              onClick={() => { setV("copilot"); setBellOpen(false); }}
                              style={{
                                display:"flex", alignItems:"center", gap:9, textAlign:"left",
                                padding:"8px 9px", borderRadius:9, cursor:"pointer", width:"100%",
                                background: isLight ? "rgba(13,154,118,0.06)" : "rgba(110,231,194,0.06)",
                                border:`1px solid ${isLight ? "rgba(13,154,118,0.22)" : "rgba(110,231,194,0.18)"}`,
                                transition:"background 0.14s",
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = isLight ? "rgba(13,154,118,0.11)" : "rgba(110,231,194,0.11)"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = isLight ? "rgba(13,154,118,0.06)" : "rgba(110,231,194,0.06)"; }}
                            >
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:12.5, fontWeight:500, color:T.txt, fontFamily:fontDisp, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                                  Asistente IA
                                </div>
                                <div style={{ fontSize:11.5, color:isLight ? T.txt2 : "rgba(255,255,255,0.55)", fontFamily:font, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                                  {copilotInbox.lastAiMessage?.content || "Nueva respuesta disponible"}
                                </div>
                              </div>
                              <span style={{
                                minWidth:16, height:16, padding:"0 5px", borderRadius:99, flexShrink:0,
                                background:T.accent, color:"#041016",
                                fontSize:10.5, fontWeight:500, fontFamily:fontDisp,
                                display:"flex", alignItems:"center", justifyContent:"center",
                              }}>{copilotUnread > 99 ? "99+" : copilotUnread}</span>
                            </button>
                          </div>
                        )}

                        {/* Estado: sin pendientes ni offline ni notificaciones sin leer */}
                        {!user?._offline && pendingSync === 0 && totalNotifUnread === 0 && (
                          <div style={{ fontSize:12.5, color: isLight ? T.txt3 : "rgba(255,255,255,0.45)", fontFamily:font, padding:"8px 0" }}>
                            Sin notificaciones nuevas.
                          </div>
                        )}

                        {/* Estado: offline */}
                        {user?._offline && isAdminRole && (
                          <div style={{
                            padding:10, borderRadius:8,
                            background: isLight ? "rgba(245,158,11,0.10)" : "rgba(245,158,11,0.10)",
                            border:`1px solid ${isLight ? "rgba(245,158,11,0.32)" : "rgba(245,158,11,0.30)"}`,
                            display:"flex", flexDirection:"column", gap:4,
                          }}>
                            <span style={{ fontSize:12, fontWeight:500, color:"#F59E0B", fontFamily:fontDisp }}>Modo offline</span>
                            <span style={{ fontSize:12, color:isLight ? T.txt2 : "rgba(255,255,255,0.65)", fontFamily:font, lineHeight:1.4 }}>
                              Servicio respondiendo lento. Los cambios se sincronizan automáticamente al recuperar conexión.
                            </span>
                          </div>
                        )}

                        {/* Estado: pending sync */}
                        {pendingSync > 0 && isAdminRole && (
                          <div style={{
                            padding:10, borderRadius:8,
                            background: isLight ? "rgba(245,158,11,0.08)" : "rgba(245,158,11,0.08)",
                            border:`1px solid ${isLight ? "rgba(245,158,11,0.28)" : "rgba(245,158,11,0.24)"}`,
                            display:"flex", flexDirection:"column", gap:8,
                          }}>
                            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                              <span style={{ fontSize:12, fontWeight:500, color:"#F59E0B", fontFamily:fontDisp }}>
                                {pendingSync} cambio{pendingSync !== 1 ? "s" : ""} pendiente{pendingSync !== 1 ? "s" : ""}
                              </span>
                            </div>
                            <span style={{ fontSize:12, color:isLight ? T.txt2 : "rgba(255,255,255,0.62)", fontFamily:font, lineHeight:1.4 }}>
                              Se intentan enviar automáticamente cada 60 s. Si llevan tiempo sin avanzar es probable que sean obsoletos.
                            </span>
                            <div style={{ display:"flex", gap:6, marginTop:2 }}>
                              <button
                                onClick={async () => { await handleSync(); }}
                                disabled={syncing}
                                style={{
                                  flex:1, padding:"7px 10px", borderRadius:7,
                                  background: syncing ? (isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.05)") : "#F59E0B",
                                  color: syncing ? (isLight ? T.txt3 : "rgba(255,255,255,0.40)") : "#0B1220",
                                  border:"none", fontSize:12, fontWeight:500, fontFamily:font,
                                  cursor: syncing ? "not-allowed" : "pointer", transition:"opacity 0.16s",
                                }}
                              >{syncing ? "Sincronizando..." : "Sincronizar ahora"}</button>
                              <button
                                onClick={() => {
                                  if (!window.confirm(`¿Descartar ${pendingSync} cambio(s) pendiente(s)? Esta acción no se puede deshacer.`)) return;
                                  const n = discardPendingSync();
                                  setPendingSync(0);
                                  setSyncMsg(`Descartados ${n} cambios pendientes.`);
                                  setTimeout(() => setSyncMsg(""), 4000);
                                }}
                                style={{
                                  padding:"7px 10px", borderRadius:7,
                                  background:"transparent",
                                  color: isLight ? T.txt2 : "rgba(255,255,255,0.55)",
                                  border:`1px solid ${isLight ? "rgba(15,23,42,0.14)" : "rgba(255,255,255,0.14)"}`,
                                  fontSize:12, fontWeight:400, fontFamily:font,
                                  cursor:"pointer", transition:"all 0.14s",
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = isLight ? "rgba(225,29,72,0.08)" : "rgba(239,68,68,0.10)"; e.currentTarget.style.color = isLight ? "#B91C1C" : "#FCA5A5"; e.currentTarget.style.borderColor = isLight ? "rgba(225,29,72,0.32)" : "rgba(239,68,68,0.32)"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = isLight ? T.txt2 : "rgba(255,255,255,0.55)"; e.currentTarget.style.borderColor = isLight ? "rgba(15,23,42,0.14)" : "rgba(255,255,255,0.14)"; }}
                              >Descartar</button>
                            </div>
                          </div>
                        )}

                        {syncMsg && (
                          <div style={{ fontSize:12, color: isLight ? T.txt2 : "rgba(255,255,255,0.65)", fontFamily:font, padding:"4px 2px" }}>
                            {syncMsg}
                          </div>
                        )}
                      </div>
                    </>
                    );
                  })(), document.body)}
                </div>
                {hDiv}
                {supportPhoneHref && (
                  <>
                    <a href={supportPhoneHref}
                      className="stratos-header-phone"
                      title={`Soporte ${supportPhoneLabel}`}
                      aria-label={`Llamar soporte ${supportPhoneLabel}`}
                      style={{ ...iBtnBase, textDecoration:"none" }}
                      onMouseEnter={onIco}
                      onMouseLeave={offIco}
                      onMouseDown={dnIco}
                      onMouseUp={upIco}
                    >
                      <PhoneCall size={14} color={icoRest} strokeWidth={1.9} />
                    </a>
                    {hDiv}
                  </>
                )}
                <button onClick={() => setTheme(isLight ? "dark" : "light")} title={isLight ? "Modo oscuro" : "Modo claro"}
                  className="stratos-theme-toggle"
                  style={{ width:42, height:24, borderRadius:12, border:"none", padding:0, flexShrink:0, background: isLight ? `linear-gradient(135deg, ${T.accent} 0%, #12B48A 100%)` : "rgba(255,255,255,0.09)", cursor:"pointer", position:"relative", transition:"background 0.28s ease", boxShadow: isLight ? `0 2px 8px ${T.accent}40, inset 0 1px 0 rgba(255,255,255,0.28)` : "inset 0 1px 3px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.08)" }}>
                  <div style={{ position:"absolute", top:3, left: isLight ? 21 : 3, width:18, height:18, borderRadius:"50%", background:"#FFFFFF", boxShadow:"0 1px 4px rgba(0,0,0,0.22), 0 2px 6px rgba(0,0,0,0.12)", transition:"left 0.28s cubic-bezier(0.34,1.56,0.64,1)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {isLight ? <Sun size={9} color={T.accent} strokeWidth={2.4} /> : <Moon size={8} color="#64748B" strokeWidth={2} fill="#64748B" />}
                  </div>
                </button>
                {hDiv}
                {/* Área del usuario — clickeable para abrir Perfil.
                    Es la entrada principal a Perfil para asesores (que no tienen
                    acceso al botón System / Gestión de Usuarios). */}
                <button type="button"
                  className="stratos-userpill"
                  onClick={() => setV("perfil")}
                  title="Mi perfil — conectar Telegram"
                  aria-current={v === "perfil" ? "page" : undefined}
                  style={{
                    display:"flex", alignItems:"center", gap:8, padding:"0 8px 0 3px",
                    height:32, borderRadius:8, cursor:"pointer", transition:"background 0.14s",
                    flexShrink:0, border:"none",
                    background: v === "perfil"
                      ? (isLight ? `${T.accent}1A` : "rgba(110,231,194,0.10)")
                      : "transparent",
                    fontFamily: font,
                  }}
                  onMouseEnter={e => { if (v !== "perfil") e.currentTarget.style.background = iBtnHoverBg; }}
                  onMouseLeave={e => { e.currentTarget.style.background = v === "perfil"
                    ? (isLight ? `${T.accent}1A` : "rgba(110,231,194,0.10)")
                    : "transparent"; }}
                >
                  <div style={{ width:26, height:26, borderRadius:"50%", flexShrink:0, background: isLight ? `linear-gradient(135deg, ${T.accent} 0%, #10B48A 100%)` : `linear-gradient(145deg, rgba(110,231,194,0.28) 0%, rgba(52,211,153,0.12) 100%)`, border: isLight ? "1.5px solid rgba(255,255,255,0.30)" : `1.5px solid rgba(110,231,194,0.24)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11.5, fontWeight:500, fontFamily:fontDisp, color: isLight ? "#FFFFFF" : T.accent, boxShadow: isLight ? `0 2px 8px ${T.accent}45` : `inset 0 1px 0 rgba(110,231,194,0.22)` }}>
                    {user?.name?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <div className="stratos-userpill-text" style={{ display:"flex", flexDirection:"column", alignItems:"flex-start" }}>
                    <span style={{ fontSize:12, fontWeight:500, fontFamily:fontDisp, letterSpacing:"-0.01em", lineHeight:1.2, color: isLight ? T.txt : "rgba(255,255,255,0.82)", whiteSpace:"nowrap" }}>
                      {user?.name?.split(" ")[0] || "Usuario"}
                    </span>
                    <span style={{ fontSize:10.5, fontWeight:400, fontFamily:font, letterSpacing:"0.02em", lineHeight:1.1, color: user?.isDemo ? T.amber : (isLight ? T.txt3 : "rgba(255,255,255,0.30)"), whiteSpace:"nowrap" }}>
                      {user?.isDemo ? "Demo" : (user?.role || "Miembro")}
                    </span>
                  </div>
                </button>
                {hDiv}
                <button onClick={onLogout} title="Cerrar sesión" style={iBtnBase}
                  onMouseEnter={e => { e.currentTarget.style.background = isLight ? "rgba(225,29,72,0.07)" : "rgba(239,68,68,0.10)"; }}
                  onMouseLeave={offIco}
                  onMouseDown={e => { e.currentTarget.style.background = isLight ? "rgba(225,29,72,0.13)" : "rgba(239,68,68,0.18)"; }}
                  onMouseUp={e => { e.currentTarget.style.background = isLight ? "rgba(225,29,72,0.07)" : "rgba(239,68,68,0.10)"; }}
                >
                  <IosIcon name="exit" size={15} color={icoRest} />
                </button>
              </div>
            </div>
          );
        })()}

        {/* CONTENT */}
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
          <div key={v} className="stratos-content-area" style={{ flex:1, padding: (v === "wa" || v === "copilot") ? 0 : "18px 22px", overflowY: (v === "wa" || v === "copilot") ? "hidden" : "auto", animation:"fadeIn 0.28s ease", display:"flex", flexDirection:"column" }}>
            {user?.role && !canAccessModule(v, user, clientConfig)
              ? <PermissionGate moduleId={v}
                  onGoBack={() => setV(user?.role === "colaborador" ? "plan" : ((user?.isMarketingAdmin || user?.role === "marketing") ? "mkt_reporte" : "c"))}
                  homeLabel={(user?.role === "marketing" || user?.role === "colaborador" || user?.isMarketingAdmin) ? "Ir a mi espacio" : "Ir a mi CRM"} />
              : <ErrorBoundary>
                <Suspense fallback={
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"60px 20px", color:T.txt3, fontFamily:font, fontSize:13 }}>
                    <span style={{ display:"inline-block", width:20, height:20, border:`2px solid ${T.accent}40`, borderTopColor:T.accent, borderRadius:"50%", animation:"spin 0.8s linear infinite", marginRight:10 }} />
                    Cargando…
                  </div>
                }>
                  {/* El Comando original es de una inmobiliaria (embudo de leads, Zoom, apartó/cierre).
                      Las empresas de OPERACIÓN (NSG) ven su propio tablero: clientes, objetivos, trabajo y caja. */}
                  {v === "d"      && (clientConfig?.features?.comandoOps
                    ? <ComandoOps T={T} accent={clientConfig?.brand?.accent} />
                    : clientConfig?.features?.comandoDirectivo
                      ? <ComandoDirectivo leadsData={leadsData} T={T} theme={theme} />
                      : <Dash oc={oc} leadsData={leadsData} T={T} />)}
                  {v === "c"      && <CRM oc={oc} leadsData={leadsData} setLeadsData={setLeadsData} theme={theme} setTheme={setTheme} isRefreshing={leadsRefreshing} autoOpenPriority1={autoOpenPriority1} onAutoOpenHandled={() => setAutoOpenPriority1(0)} softDeleteLead={softDeleteLead} autoOpenLead={crmAutoOpenLead} onAutoOpenLeadHandled={() => setCrmAutoOpenLead(null)} autoOpenNewLead={crmNewLeadTick} onNewLeadHandled={() => setCrmNewLeadTick(0)} onOpenComando={() => setV("d")} />}
                  {v === "wa"     && canAccessModule("wa", user, clientConfig) && <WhatsAppInbox T={T} isLight={isLight} inbox={waInbox} openLead={waOpenLead} openExpediente={openLeadExpediente} onBack={backToPrevView} chatCount={waInbox.conversations?.length || 0} />}
                  {v === "copilot" && canAccessModule("copilot", user, clientConfig) && <Copilot T={T} isLight={isLight} theme={theme} onBack={backToPrevView} score={asesorScore} />}
                  {(v === "mkt" || v === "mkt_reporte" || v === "mkt_equipo" || v === "mkt_dia" || v === "mkt_marcas" || v === "mkt_pipe" || v === "mkt_sol") && canAccessModule(v, user, clientConfig) && (
                    <Marketing T={T}
                      initialTab={{ mkt_reporte: "reporte", mkt_equipo: "equipo", mkt_dia: "dia", mkt_marcas: "marcas", mkt_pipe: "pipeline", mkt_sol: "solicitudes" }[v]}
                      onOpenCopilot={canAccessModule("copilot", user, clientConfig) ? () => setV("copilot") : undefined} />
                  )}
                  {v === "plan"   && canAccessModule("plan", user, clientConfig) && (
                    <PlanSemanal T={T} onOpenCopilot={canAccessModule("copilot", user, clientConfig) ? () => setV("copilot") : undefined} />
                  )}
                  {v === "midrive" && canAccessModule("midrive", user, clientConfig) && <MiDrive T={T} />}
                  {v === "trash"  && <Trash trashedLeads={trashedLeads} onRestore={restoreLead} onHardDelete={hardDeleteLead} onRefresh={refreshTrash} T={T} />}
                  {v === "ia"     && <IACRM oc={oc} T={T} theme={theme} />}
                  {v === "e"      && <ERP oc={oc} T={T} />}
                  {v === "a"      && <Team oc={oc} T={T} leadsData={leadsData} />}
                  {v === "lp"     && <LandingPages T={T} />}
                  {v === "fa"     && <FinanzasAdmin T={T} />}
                  {v === "caja"   && canAccessModule("caja", user, clientConfig) && <Caja T={T} />}
                  {v === "chat"   && canAccessModule("chat", user, clientConfig) && <ChatEquipo T={T} onInmersivo={setChatInmersivo} />}
                  {v === "rrhh"   && <RRHHModule T={T} />}
                  {v === "planes" && (
                    <div style={{
                      // Full-bleed: cancela el gutter del content-area para que el
                      // pricing (oscuro por diseño) ocupe TODA la pantalla y no
                      // parezca un bloque negro flotando sobre el lienzo claro.
                      margin: "-20px -16px calc(-92px - var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))) -16px",
                      background: "#04080F",
                      minHeight: "100dvh",
                      paddingBottom: "calc(96px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))",
                    }}>
                      <PricingScreen embedded onBack={() => setV(isAsesorRole ? "c" : "d")} />
                    </div>
                  )}
                  {v === "perfil" && <Profile theme={theme} T={T} />}
                  {v === "admin"  && canAccessModule("admin", user, clientConfig) && <AdminPanel T={T} isLight={isLight} />}
                  {v === "rails"  && canAccessModule("rails", user, clientConfig) && <RailsSettings T={T} isLight={isLight} />}
                </Suspense>
              </ErrorBoundary>
            }
          </div>
          <Chat open={co} onClose={() => setCo(false)} msgs={msgs} setMsgs={setMsgs} inp={inp} setInp={setInp} />
        </div>
      </div>

      {/* ══ MOBILE BOTTOM NAV — cápsula flotante estilo Apple Music ══ */}
      {/* Como la referencia que mandó Iván/Ángel: una CÁPSULA flotante con
          3 módulos + tab "Menú" (burbuja resaltada en el activo) y un botón
          CIRCULAR "+" separado a la derecha que CREA UN CLIENTE (reemplaza
          al FAB del CRM que aparecía y desaparecía). El fondo es casi opaco
          a propósito: mobile-perf.css mata el backdrop-filter en móvil. */}
      <div className="stratos-bottomnav">
        <div style={{
          display:"flex", alignItems:"center", gap:2, flex:1, minWidth:0,
          // Barra DOCKEADA estilo app nativa (Instagram/Mercado Libre): full-width,
          // pegada al borde inferior; el safe-area (home indicator) lo rellena el
          // padding de la propia barra. El relleno EXTRA sobre el home indicator
          // se bajó 10→3px (pedido de Ángel: aprovechar más el espacio de abajo,
          // como MeLi) — la franja del home indicator (safe-area) se RESPETA
          // completa para no chocar con el gesto de inicio de iOS.
          padding:"6px 8px calc(3px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))",
          borderRadius:"18px 18px 0 0",
          background: isLight ? "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.97))" : "linear-gradient(180deg, rgba(18,24,32,0.98) 0%, rgba(9,12,18,0.99) 100%)",
          borderTop:`1px solid ${isLight ? "rgba(15,23,42,0.07)" : "rgba(255,255,255,0.08)"}`,
          boxShadow: isLight
            ? "inset 0 1px 0 rgba(255,255,255,1), 0 -8px 26px rgba(15,23,42,0.10)"
            : "inset 0 1px 0 rgba(190,245,225,0.07), 0 -10px 32px rgba(0,0,0,0.50)",
          backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)",
        }}>
          {mobilePrimaryBar.map(n => {
            const a = v === n.id && !plusOpen;
            const activeColor = isLight ? T.accent : "#E9FCF4";
            return (
              <button key={n.id} onClick={() => { setV(n.id); setPlusOpen(false); }} style={{
                display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3,
                flex:1, minWidth:0, padding:"7px 4px", borderRadius:14, cursor:"pointer",
                border: a ? (isLight ? "1px solid rgba(15,23,42,0.10)" : "1px solid rgba(190,245,225,0.16)") : "1px solid transparent",
                background: a ? (isLight ? "linear-gradient(180deg, rgba(255,255,255,0.86), rgba(248,250,252,0.68))" : "linear-gradient(180deg, rgba(255,255,255,0.065), rgba(110,231,194,0.022))") : "transparent",
                boxShadow: a ? (isLight ? "0 3px 10px rgba(15,23,42,0.06)" : "0 3px 10px rgba(0,0,0,0.24)") : "none",
                outline:"none", WebkitTapHighlightColor:"transparent",
                transition:"background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
              }}>
                {n.id === "copilot"
                  ? <CopilotMark size={23} isLight={isLight} style={{ opacity: a ? 1 : 0.85 }} />
                  : <IosIcon name={n.id} filled={a} size={n.id === "d" ? 23 : n.id === "ia" ? 22 : n.id === "lp" ? 22 : n.id === "e" ? 21 : n.id === "c" ? 22 : 20} color={a ? activeColor : (isLight ? "rgba(15,23,42,0.45)" : "rgba(255,255,255,0.40)")} />}
                <span style={{ fontSize:10.5, fontFamily:fontDisp, fontWeight: a ? 700 : 500, letterSpacing:"-0.01em", color: a ? activeColor : (isLight ? "rgba(15,23,42,0.42)" : "rgba(255,255,255,0.34)"), lineHeight:1, whiteSpace:"nowrap", overflow:"hidden", maxWidth:"100%" }}>{clientConfig?.navLabels?.[n.id] ?? n.l}</span>
              </button>
            );
          })}
          {/* Tab "Menú" — abre el cuadro centrado con TODOS los módulos +
              Centro de Inteligencia + configuración */}
          {(() => {
            const inBar = mobilePrimaryBar.some(n => n.id === v);
            const a = plusOpen || !inBar;
            const activeColor = isLight ? T.accent : "#E9FCF4";
            return (
              <button onClick={() => setPlusOpen(p => !p)} aria-label="Menú — todas las opciones" style={{
                display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3,
                flex:1, minWidth:0, padding:"7px 4px", borderRadius:14, cursor:"pointer",
                border: a ? (isLight ? "1px solid rgba(15,23,42,0.10)" : "1px solid rgba(190,245,225,0.16)") : "1px solid transparent",
                background: a ? (isLight ? "linear-gradient(180deg, rgba(255,255,255,0.86), rgba(248,250,252,0.68))" : "linear-gradient(180deg, rgba(255,255,255,0.065), rgba(110,231,194,0.022))") : "transparent",
                boxShadow: a ? (isLight ? "0 3px 10px rgba(15,23,42,0.06)" : "0 3px 10px rgba(0,0,0,0.24)") : "none",
                outline:"none", WebkitTapHighlightColor:"transparent",
                transition:"background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
              }}>
                <IosIcon name="menu" filled={a} size={20} color={a ? activeColor : (isLight ? "rgba(15,23,42,0.45)" : "rgba(255,255,255,0.40)")} />
                <span style={{ fontSize:10.5, fontFamily:fontDisp, fontWeight: a ? 700 : 500, color: a ? activeColor : (isLight ? "rgba(15,23,42,0.42)" : "rgba(255,255,255,0.34)"), lineHeight:1 }}>Menú</span>
              </button>
            );
          })()}
          {/* Botón "+" — NUEVO CLIENTE, integrado a la barra como en las apps
              nativas (antes flotaba aparte y dejaba aire abajo). Solo para quien
              tiene el CRM: para marketing (Alex/rol marketing) NO se muestra (es de ventas). */}
          {hasCRM && (
          <button
            onClick={() => { setPlusOpen(false); setV("c"); setCrmNewLeadTick(t => t + 1); }}
            aria-label="Nuevo cliente"
            style={{
              width:46, height:46, borderRadius:999, border:"none", cursor:"pointer", flexShrink:0,
              alignSelf:"center", marginLeft:6, marginRight:2,
              background: isLight ? `linear-gradient(135deg, ${T.accent}, ${T.accent}CC)` : "linear-gradient(135deg, #6EE7C2, #34D399)",
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow: isLight ? `0 6px 16px ${T.accent}50, 0 2px 6px rgba(15,23,42,0.12)` : "0 6px 18px rgba(52,211,153,0.35), 0 2px 8px rgba(0,0,0,0.35)",
              outline:"none", WebkitTapHighlightColor:"transparent",
            }}
            onTouchStart={e => { e.currentTarget.style.transform = "scale(0.93)"; }}
            onTouchEnd={e => { e.currentTarget.style.transform = "scale(1)"; }}
            onTouchCancel={e => { e.currentTarget.style.transform = "scale(1)"; }}
          >
            <IosIcon name="add" filled size={24} color={isLight ? "#FFFFFF" : "#04121C"} />
          </button>
          )}
        </div>
      </div>

      {/* ── Cuadro CENTRADO "todas las opciones" — PORTAL a <body>: dentro del
          .stratos-bottomnav el backdrop-filter crea un containing block y el
          position:fixed del cuadro quedaba anclado a la barra (cortado abajo).
          Solo se abre desde el "+" (visible únicamente en móvil). ── */}
      {/* ── AVISO "Activa los avisos de llamada" — tenants con reunionButton.
          Tarjeta flotante (portal a <body>, sobre el bottom-nav) que pide el
          gesto para el permiso de notificaciones. Sin esto el teléfono no
          suena con la app cerrada. Se posterga ~1 día con "Ahora no". ── */}
      {callPushPrompt && createPortal(
        <div style={{ position: "fixed", left: 12, right: 12, bottom: "calc(96px + env(safe-area-inset-bottom, 0px))", zIndex: 99960, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ pointerEvents: "auto", width: "100%", maxWidth: 430, borderRadius: 18, padding: "14px 16px", fontFamily: font,
            background: isLight ? "#FFFFFF" : "#0A1420",
            border: `1px solid ${callPushPrompt === "done" ? "rgba(52,211,153,0.55)" : (isLight ? "rgba(15,23,42,0.14)" : "rgba(110,231,194,0.28)")}`,
            boxShadow: isLight ? "0 18px 50px rgba(15,23,42,0.25)" : "0 18px 50px rgba(0,0,0,0.55)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(52,211,153,0.14)", border: "1px solid rgba(52,211,153,0.45)",
                animation: callPushPrompt === "activate" ? "stratosNewLeadPulse 1.8s ease-in-out infinite" : "none" }}>
                <PhoneCall size={17} color="#34D399" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, fontFamily: fontDisp, letterSpacing: "-0.01em", color: isLight ? "#0B1220" : "#F1F5F9" }}>
                  {callPushPrompt === "done" ? "¡Listo! Avisos de llamada activados" :
                   callPushPrompt === "install" ? "Falta un paso en tu iPhone" :
                   callPushPrompt === "denied" ? "Los avisos están bloqueados" :
                   callPushPrompt === "brave" ? "Brave trae los avisos apagados" :
                   callPushPrompt === "navegador" ? "Este navegador no admite avisos" :
                   callPushPrompt === "reintentar" ? "No se pudo activar" :
                   "Activa los avisos de llamada"}
                </div>
                <div style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 4, color: isLight ? "rgba(11,18,32,0.62)" : "rgba(255,255,255,0.62)" }}>
                  {callPushPrompt === "done" && "Cuando un compañero te llame, el teléfono te avisará al instante — en Android con botones Contestar / Rechazar; en iPhone tocas el aviso y entras directo a la reunión."}
                  {callPushPrompt === "activate" && "Para que te suene cuando un compañero te llame (como WhatsApp), permite las notificaciones. En Android el aviso trae botones Contestar / Rechazar; en iPhone tocas el aviso y entras directo."}
                  {callPushPrompt === "install" && "iPhone solo permite avisos con la app en la pantalla de inicio: abre esta página en Safari → botón Compartir → “Agregar a inicio”. Después entra desde ese ícono y vuelve a este aviso para activar."}
                  {callPushPrompt === "denied" && "Este navegador tiene las notificaciones de Stratos bloqueadas. Actívalas en Ajustes → Notificaciones de tu teléfono (o en el candado de la barra del navegador) y vuelve a entrar."}
                  {/* Brave apaga el servicio de push de fábrica: el permiso se
                      concede pero la suscripción falla. Es un interruptor del
                      navegador, no algo que podamos arreglar desde acá — así que
                      se dice exactamente dónde está. */}
                  {callPushPrompt === "brave" && "Brave viene con la mensajería push apagada de fábrica, por eso el permiso se concede pero el aviso nunca llega. Abre brave://settings/privacy, prende «Usar los servicios de Google para la mensajería push», cierra Brave por completo y vuelve a entrar. Si prefieres no tocar eso, en Chrome o en Safari funciona sin configurar nada."}
                  {callPushPrompt === "navegador" && "Este navegador no admite avisos del sistema. En Mac funcionan con Safari 16.1 o superior (macOS 13 en adelante) y con Chrome; en Windows, con Chrome o Edge. Si estás en Safari y no te deja, revisa Safari → Ajustes → Sitios web → Notificaciones y que stratoscapitalgroup.com esté en «Permitir»."}
                  {callPushPrompt === "reintentar" && "El permiso quedó dado, pero el navegador no completó la suscripción. Suele destrabarse cerrando la pestaña y volviendo a entrar. Si sigue igual, avísanos y lo miramos con el detalle de tu navegador."}
                </div>
                {callPushPrompt !== "done" && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    {callPushPrompt === "activate" && (
                      <button onClick={activateCallPush} disabled={callPushBusy}
                        style={{ flex: 1, padding: "10px 12px", borderRadius: 999, border: "none", background: "#34D399", color: "#04211A",
                          fontSize: 13, fontWeight: 700, fontFamily: font, cursor: "pointer", opacity: callPushBusy ? 0.6 : 1 }}>
                        {callPushBusy ? "Activando…" : "🔔 Activar ahora"}
                      </button>
                    )}
                    <button onClick={snoozeCallPush}
                      style={{ flex: callPushPrompt === "activate" ? "0 0 auto" : 1, padding: "10px 14px", borderRadius: 999,
                        border: `1px solid ${isLight ? "rgba(15,23,42,0.16)" : "rgba(255,255,255,0.16)"}`, background: "transparent",
                        color: isLight ? "rgba(11,18,32,0.6)" : "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 600, fontFamily: font, cursor: "pointer" }}>
                      {callPushPrompt === "activate" ? "Ahora no" : "Entendido"}
                    </button>
                  </div>
                )}
              </div>
              <button onClick={snoozeCallPush} title="Cerrar"
                style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", border: "none", background: "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                  color: isLight ? "rgba(11,18,32,0.45)" : "rgba(255,255,255,0.45)" }}>
                <X size={15} />
              </button>
            </div>
          </div>
        </div>, document.body)}
      {/* ── LLAMADA ENTRANTE (overlay estilo WhatsApp) — tenants con reunionButton.
          Aparece ENCIMA de todo cuando un compañero te llama (Realtime sobre
          proactive_reminders): Contestar abre el Meet, Rechazar la cierra, y se
          apaga sola a los 45s como un teléfono que deja de sonar. ── */}
      {incomingCall && createPortal(
        /* ⚠️ SIN `backdropFilter` inline, A PROPÓSITO. [guard:CALL-OPAQUE]
           Ángel mandó captura (27-jul): la pantalla de llamada se veía TRANSPARENTE,
           con el chat legible por detrás. Causa exacta: en modo seguro
           (`html[data-lowfx]`, que se enciende solo tras los cierres en negro del
           iPhone) `mobile-perf.css` matchea CUALQUIER elemento con `backdropFilter`
           inline y le fuerza `background-color: rgba(9,18,37,0.72)`. Esa regla está
           pensada para las TARJETAS de vidrio, no para un velo de pantalla completa
           — y le bajaba el fondo del 94% al 72%.
           Por eso acá el velo es un color SÓLIDO, sin alfa y sin filtro: no depende
           de ningún efecto que el modo seguro pueda apagar. Si alguien le vuelve a
           poner blur, vuelve el bug. */
        <div style={{ position: "fixed", inset: 0, zIndex: 99995, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, background: "#03070D", padding: 24 }}>
          <div style={{ width: 92, height: 92, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: `${P.accent}1c`, border: `2px solid ${P.accent}66`, animation: "stratosNewLeadPulse 1.6s ease-in-out infinite" }}>
            <PhoneCall size={38} color={P.accent} />
          </div>
          <div style={{ textAlign: "center", maxWidth: 340 }}>
            <div style={{ fontSize: 23, fontWeight: 700, color: "#FFFFFF", fontFamily: fontDisp, letterSpacing: "-0.01em", textWrap: "balance" }}>{incomingCall.caller}</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.68)", marginTop: 6 }}>te está llamando · Reunión de equipo</div>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8, width: "100%", maxWidth: 360 }}>
            <button onClick={() => { marcarLlamadaDespachada(incomingCall.id); closeCallNotifications(); setIncomingCall(null); }}
              style={{ flex: 1, minHeight: 54, padding: "15px 12px", borderRadius: 999, border: "1px solid #7F3B3B", background: "#2A1214", color: "#FCA5A5", fontSize: 15.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <PhoneOff size={17} /> Rechazar
            </button>
            <button onClick={() => { const m = incomingCall.meet; marcarLlamadaDespachada(incomingCall.id); closeCallNotifications(); setIncomingCall(null); window.open(m, "_blank", "noopener"); }}
              style={{ flex: 1, minHeight: 54, padding: "15px 12px", borderRadius: 999, border: "none", background: P.accent, color: "#04211A", fontSize: 15.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, boxShadow: `0 8px 26px ${P.accent}38` }}>
              <PhoneCall size={17} /> Contestar
            </button>
          </div>
        </div>, document.body)}
      {plusOpen && createPortal(
        <>
          <div onClick={() => setPlusOpen(false)} style={{ position:"fixed", inset:0, zIndex:202, background: isLight ? "rgba(15,23,42,0.34)" : "rgba(1,3,9,0.66)", animation:"fadeIn 0.18s ease both" }} />
          <div style={{
            /* transform INLINE (no via animación): mobile-perf.css apaga las
               animaciones inline en móvil y el translate del keyframe modalIn
               se perdería → cuadro descentrado. */
            position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)", zIndex:203,
            width:"min(92vw, 400px)", maxHeight:"min(76dvh, 620px)", overflowY:"auto",
            borderRadius:26, padding:"16px 16px 18px",
            background: isLight ? "#FFFFFF" : "#0A0F1C",
            border:`1px solid ${isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.09)"}`,
            boxShadow: isLight ? "0 24px 70px rgba(15,23,42,0.28)" : "0 24px 80px rgba(0,0,0,0.72), 0 0 0 1px rgba(255,255,255,0.03)",
            animation:"modalIn 0.24s cubic-bezier(0.16,1,0.3,1) both",
          }}>
            {/* Header del cuadro */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <span style={{ fontSize:13, fontWeight:500, fontFamily:fontDisp, letterSpacing:"-0.02em", color: isLight ? T.txt : "#FFFFFF" }}>Todas las opciones</span>
              <button onClick={() => setPlusOpen(false)} aria-label="Cerrar" style={{ width:28, height:28, borderRadius:9, border:"none", cursor:"pointer", background: isLight ? "rgba(15,23,42,0.05)" : "rgba(255,255,255,0.06)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <X size={14} color={isLight ? T.txt2 : "rgba(255,255,255,0.55)"} />
              </button>
            </div>

            {/* "Mi Espacio" (MetaPanel) — en móvil la barra lateral con el widget
                AVANCE no existe; ESTE es su punto de entrada. Abre agenda, Lista
                de Acción · Documentos · Plan · Protocolo de Ventas.
                (Antes decía "Plan Estratégico"; y arriba había una tarjeta
                "Centro de Inteligencia" — Ángel la quitó del menú: su acceso
                sigue en la pastilla del header + la campanita. 2026-07-17.) */}
            <button onClick={() => { setPlusOpen(false); setMetaOpen(true); }} style={{
              width:"100%", display:"flex", alignItems:"center", gap:11, padding:"12px 13px",
              borderRadius:16, marginBottom:12, cursor:"pointer", textAlign:"left",
              background: isLight ? "linear-gradient(135deg, rgba(37,99,235,0.10), rgba(13,154,118,0.05))" : "linear-gradient(135deg, rgba(126,184,240,0.12), rgba(110,231,194,0.05))",
              border:`1px solid ${isLight ? "rgba(37,99,235,0.22)" : "rgba(126,184,240,0.25)"}`,
            }}>
              <div style={{ width:36, height:36, borderRadius:11, background: isLight ? "rgba(37,99,235,0.10)" : "rgba(126,184,240,0.14)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <Target size={19} color={isLight ? "#2563EB" : "#7EB8F0"} strokeWidth={2} />
              </div>
              <div style={{ minWidth:0 }}>
                <p style={{ margin:0, fontSize:13, fontWeight:500, fontFamily:fontDisp, letterSpacing:"-0.015em", color: isLight ? T.txt : "#FFFFFF", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>Mi Espacio{user?.name ? ` · ${user.name.split(" ")[0]}` : ""}</p>
                <p style={{ margin:"2px 0 0", fontSize:11.5, fontFamily:font, color: isLight ? T.txt3 : "rgba(255,255,255,0.42)" }}>Agenda, lista de acción, documentos y plan</p>
              </div>
            </button>

            {/* TODOS los módulos */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:8 }}>
              {mobileAllNav.filter(n => n.id !== "admin").map(n => {
                const a = v === n.id;
                const activeColor = n.adminOnly ? "#A78BFA" : (isLight ? T.accent : "#E9FCF4");
                return (
                  <button key={n.id} onClick={() => { setV(n.id); setPlusOpen(false); }} style={{
                    display:"flex", flexDirection:"column", alignItems:"center", gap:6, padding:"13px 4px 11px",
                    borderRadius:16, border: a ? (isLight ? `1px solid ${activeColor}45` : "1px solid rgba(190,245,225,0.16)") : (isLight ? "1px solid rgba(15,23,42,0.06)" : "1px solid rgba(255,255,255,0.05)"),
                    cursor:"pointer", minWidth:0,
                    background: a ? (isLight ? `linear-gradient(180deg, rgba(255,255,255,0.95), ${activeColor}12)` : "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(110,231,194,0.03))") : (isLight ? "rgba(15,23,42,0.02)" : "rgba(255,255,255,0.025)"),
                  }}>
                    {n.id === "copilot"
                      ? <CopilotMark size={22} isLight={isLight} animated={false} style={{ opacity: a ? 1 : 0.85 }} />
                      : <IosIcon name={n.id} filled={a} size={22} color={a ? activeColor : (isLight ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.55)")} />}
                    <span style={{ fontSize:11, fontFamily:fontDisp, fontWeight: a ? 700 : 500, color: a ? activeColor : (isLight ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.50)"), lineHeight:1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:"100%" }}>{clientConfig?.navLabels?.[n.id] ?? n.l}</span>
                  </button>
                );
              })}
            </div>

            {/* Configuración: usuarios (admin) + tema + salir */}
            {mobileAllNav.some(n => n.id === "admin") && (
              <button onClick={() => { setV("admin"); setPlusOpen(false); }} style={{
                width:"100%", display:"flex", alignItems:"center", gap:10, padding:"11px 13px", marginTop:12, borderRadius:13, cursor:"pointer", textAlign:"left",
                border:`1px solid ${isLight ? "rgba(167,139,250,0.28)" : "rgba(167,139,250,0.30)"}`,
                background: isLight ? "rgba(167,139,250,0.08)" : "rgba(167,139,250,0.10)",
              }}>
                <IosIcon name="admin" filled size={16} color="#A78BFA" />
                <span style={{ fontSize:12.5, fontWeight:400, fontFamily:fontDisp, color: isLight ? "#6D45C9" : "#C9B8F5" }}>Gestión de usuarios</span>
              </button>
            )}
            <div style={{ display:"flex", gap:8, marginTop:8 }}>
              <button onClick={() => setTheme(isLight ? "dark" : "light")} style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:7, padding:"11px 8px", borderRadius:13, border:`1px solid ${isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.07)"}`, background: isLight ? "rgba(15,23,42,0.03)" : "rgba(255,255,255,0.04)", cursor:"pointer" }}>
                {isLight ? <IosIcon name="moon" filled size={15} color={T.txt2} /> : <IosIcon name="sun" filled size={15} color="rgba(255,255,255,0.60)" />}
                <span style={{ fontSize:12, fontWeight:400, fontFamily:fontDisp, color: isLight ? T.txt2 : "rgba(255,255,255,0.60)" }}>{isLight ? "Modo oscuro" : "Modo claro"}</span>
              </button>
              <button onClick={() => { setPlusOpen(false); onLogout(); }} style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:7, padding:"11px 8px", borderRadius:13, border:`1px solid ${isLight ? "rgba(225,29,72,0.16)" : "rgba(232,129,140,0.18)"}`, background: isLight ? "rgba(225,29,72,0.05)" : "rgba(232,129,140,0.07)", cursor:"pointer" }}>
                <IosIcon name="exit" filled size={15} color={isLight ? "#BE123C" : "#E8818C"} />
                <span style={{ fontSize:12, fontWeight:400, fontFamily:fontDisp, color: isLight ? "#BE123C" : "#E8818C" }}>Salir</span>
              </button>
            </div>

            {/* Sello de la versión web que corre ESTE dispositivo. El shell
                nativo carga la web remota: un APK nuevo NO garantiza web nueva
                (SW/deploy). Con esto cualquiera puede reportar "web vNNN" y se
                acaba el adivinar. Mantener en sync con CACHE_VERSION (sw.js). */}
            <p style={{ margin:"12px 0 0", textAlign:"center", fontSize:10.5, fontFamily:font, letterSpacing:"0.02em", color: isLight ? "rgba(15,23,42,0.35)" : "rgba(255,255,255,0.28)" }}>Stratos CRM AI · web v256</p>
          </div>
        </>,
        document.body
      )}

      {/* ══ MODAL "Aplicaciones" (desktop) — grid centrado con TODAS las apps ══ */}
      {sidebarMore && createPortal(
        <>
          <div onClick={() => setSidebarMore(false)} style={{ position:"fixed", inset:0, zIndex:700, background: isLight ? "rgba(15,23,42,0.35)" : "rgba(2,4,9,0.68)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", animation:"fadeIn 0.18s ease both" }} />
          <div style={{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)", zIndex:701, width:"min(90vw, 560px)", borderRadius:26, padding:"22px 22px 24px", background: isLight ? "#FFFFFF" : "#0A0F1C", border: isLight ? "1px solid rgba(15,23,42,0.10)" : "1px solid rgba(255,255,255,0.10)", boxShadow: isLight ? "0 30px 80px rgba(15,23,42,0.22), 0 0 1px 1px rgba(15,23,42,0.05)" : "inset 0 1px 0 rgba(190,245,225,0.08), inset 0 -1px 0 rgba(0,0,0,0.4), 0 30px 90px rgba(0,0,0,0.72)", animation:"modalIn 0.24s cubic-bezier(0.16,1,0.3,1) both" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
              <span style={{ fontSize:15, fontWeight:600, fontFamily:fontDisp, letterSpacing:"-0.02em", color: isLight ? T.txt : "#FFFFFF" }}>Aplicaciones</span>
              <button onClick={() => setSidebarMore(false)} aria-label="Cerrar" style={{ width:30, height:30, borderRadius:10, border:"none", cursor:"pointer", background: isLight ? "#F1F5F9" : "rgba(255,255,255,0.06)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <X size={16} color={isLight ? T.txt2 : "rgba(255,255,255,0.55)"} />
              </button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:12 }}>
              {accessibleAll.filter(n => n.id !== "admin").map(n => {
                const act = v === n.id;
                const acol = n.adminOnly ? "#A78BFA" : (isLight ? T.accent : "#E9FCF4");
                return (
                  <button key={n.id} onClick={() => { if (n.id === "miespacio") { setMetaOpen(true); setSidebarMore(false); return; } setV(n.id); setSidebarMore(false); setMetaOpen(false); }} style={{
                    display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:9, padding:"18px 6px", borderRadius:18, cursor:"pointer",
                    border: act ? (isLight ? `1.5px solid ${acol}` : "1px solid rgba(190,245,225,0.20)") : (isLight ? "1px solid rgba(15,23,42,0.08)" : "1px solid rgba(255,255,255,0.06)"),
                    background: act ? (isLight ? `linear-gradient(180deg, #FFFFFF, ${acol}14)` : "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(110,231,194,0.04))") : (isLight ? "#F8FAFC" : "rgba(255,255,255,0.03)"),
                    boxShadow: act ? (isLight ? `0 6px 16px ${acol}22` : "0 4px 12px rgba(0,0,0,0.3)") : "none",
                    transition:"all 0.16s ease",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px)"; if(!act) { e.currentTarget.style.background = isLight ? "#FFFFFF" : "rgba(255,255,255,0.06)"; e.currentTarget.style.boxShadow = isLight ? "0 4px 12px rgba(15,23,42,0.06)" : "0 4px 12px rgba(0,0,0,0.2)"; } }}
                  onMouseLeave={e => { e.currentTarget.style.transform="none"; if(!act) { e.currentTarget.style.background = isLight ? "#F8FAFC" : "rgba(255,255,255,0.03)"; e.currentTarget.style.boxShadow = "none"; } }}
                  >
                    {/* El Copilot lleva SU marca, igual que en el rail. Acá salía
                        con el ícono genérico, así que la misma app se veía con dos
                        dibujos distintos según por dónde entraras. */}
                    {n.id === "copilot"
                      ? <CopilotMark size={28} isLight={isLight} />
                      : <IosIcon name={n.id} filled={act} size={26} color={act ? acol : (isLight ? "rgba(15,23,42,0.50)" : "rgba(255,255,255,0.55)")} />}
                    <span style={{ fontSize:12, fontFamily:fontDisp, fontWeight: act ? 700 : 500, letterSpacing:"-0.01em", color: act ? acol : (isLight ? "rgba(15,23,42,0.60)" : "rgba(255,255,255,0.62)"), lineHeight:1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:"100%" }}>{clientConfig?.navLabels?.[n.id] ?? n.l}</span>
                  </button>
                );
              })}
            </div>
            {/* Configuración: Usuarios (Gestión de usuarios) vive acá, no en la grilla de apps */}
            {accessibleAll.some(n => n.id === "admin") && (
              <>
                <div style={{ height:1, margin:"18px 2px 14px", background: isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.05)" }} />
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
                  <span style={{ fontSize:11.5, fontWeight:500, fontFamily:fontDisp, letterSpacing:"0.08em", textTransform:"uppercase", color: isLight ? "rgba(15,23,42,0.42)" : "rgba(255,255,255,0.36)" }}>Configuración</span>
                  <button onClick={() => { setV("admin"); setSidebarMore(false); }} style={{
                    display:"flex", alignItems:"center", gap:9, padding:"10px 16px", borderRadius:14, cursor:"pointer",
                    border: `1px solid ${v === "admin" ? "rgba(167,139,250,0.45)" : (isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.07)")}`,
                    background: v === "admin" ? "rgba(167,139,250,0.12)" : (isLight ? "rgba(15,23,42,0.03)" : "rgba(255,255,255,0.03)"),
                    transition:"background 0.18s ease, border-color 0.18s ease",
                  }}
                  onMouseEnter={e => { if(v !== "admin") e.currentTarget.style.background = isLight ? "rgba(167,139,250,0.08)" : "rgba(167,139,250,0.08)"; }}
                  onMouseLeave={e => { if(v !== "admin") e.currentTarget.style.background = isLight ? "rgba(15,23,42,0.03)" : "rgba(255,255,255,0.03)"; }}
                  >
                    <IosIcon name="admin" filled={v === "admin"} size={18} color="#A78BFA" />
                    <span style={{ fontSize:12.5, fontFamily:fontDisp, fontWeight:400, color: isLight ? T.txt2 : "rgba(255,255,255,0.74)" }}>Usuarios</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </>,
        document.body
      )}

      {/* ══ META PANEL ══ */}
      <MetaPanel
        open={metaOpen}
        onClose={() => setMetaOpen(false)}
        user={user}
        metaTab={metaTab}
        setMetaTab={setMetaTab}
        metaActions={metaActions}
        setMetaActions={setMetaActions}
        metaNewText={metaNewText}
        setMetaNewText={setMetaNewText}
        doneCollapsed={doneCollapsed}
        setDoneCollapsed={setDoneCollapsed}
        metaPlan={effectiveMetaPlan}
        setMetaPlan={handleSetMetaPlan}
        metaProtocol={effectiveMetaProtocol}
        setMetaProtocol={handleSetMetaProtocol}
        metaDocs={metaDocs}
        setMetaDocs={handleSetMetaDocs}
        leadsData={leadsData}
        T={T}
        isLight={isLight}
        orgBrand={orgBrand}
        canEdit={["super_admin","admin"].includes(user?.role)}
        savingConfig={!!orgMetaConfig?._dirty}
      />
    </div>
  );
}
