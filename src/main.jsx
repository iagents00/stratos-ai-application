/**
 * main.jsx — Entry point de Stratos AI
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsabilidades de este archivo (y SOLO estas):
 *   1. Renderizar el árbol de React en el DOM
 *   2. Proveer el contexto global de autenticación (AuthProvider)
 *   3. Decidir qué experiencia mostrar según el hostname/URL
 *
 * ROUTING POR HOSTNAME (sin React Router — decisión intencional):
 *   app.stratoscapitalgroup.com  →  Plataforma autenticada (App)
 *   stratoscapitalgroup.com      →  Landing pública (LandingMarketing)
 *   localhost:5173/?app          →  Plataforma (modo desarrollo)
 *   localhost:5173               →  Landing (modo desarrollo)
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";

import { AuthProvider }   from "./contexts/AuthContext";
import { ClientProvider } from "./contexts/ClientContext";
import { ClientOrgGuard } from "./contexts/ClientOrgGuard";
import { resolveClientFromLocation, matchClientFromLocation } from "./clients";
import ErrorBoundary   from "./components/ErrorBoundary.jsx";
import { recoverFromStaleChunk } from "./lib/chunk-recovery.js";

// Code-splitting: solo se carga el bundle de la experiencia que el usuario
// realmente abrió. Antes este import era estático y arrastraba todo a 922KB.
const App              = lazy(() => import("./app/App.jsx"));
const LandingMarketing = lazy(() => import("./landing/LandingMarketing.jsx"));
const PrivacyPolicy    = lazy(() => import("./landing/PrivacyPolicy.jsx"));
const PublicLanding    = lazy(() => import("./app/views/LandingPages/PublicLanding.jsx"));
const DataDeletion     = lazy(() => import("./landing/DataDeletion.jsx"));
const DeliveryHubCRM   = lazy(() => import("./landing/DeliveryHubCRM.jsx"));
const ManualCRM        = lazy(() => import("./landing/ManualCRM.jsx"));
const Diagnostico      = lazy(() => import("./landing/Diagnostico.jsx"));
import { CATEGORIES_TG, MANUAL_SECTIONS_TG, searchManualTG } from "./landing/manual-telegram-content";

import "./index.css";
// Mitigación de crash en Safari iOS (memoria de compositing): baja el blur de
// vidrio y frena animaciones continuas en móvil. Reversible: borrar el archivo
// + este import. Ver src/mobile-perf.css.
import "./mobile-perf.css";

// ─── BOOT GUARD: limpieza de tokens legacy ──────────────────────────────────
// Versiones anteriores guardaban basura en localStorage que rompía sesiones:
//   1. `stratos.supabase.*` — storageKey custom pre-#43, huérfano del SDK.
//   2. `sb-<ref>-auth-token-code-verifier` — code_verifier del flow PKCE
//      que estaba mal configurado (era para OAuth, no para password). Cuando
//      el SDK encontraba este verifier al refrescar la página, intentaba
//      completar un flow PKCE que nunca empezó → sesión invalidada →
//      retry POST /token?grant_type=password con error 400 → usuario fuera.
// Borrar ambos al boot garantiza arranque limpio. NO toca `sb-<ref>-auth-token`
// (el token JWT real), que es lo que persiste la sesión.
try {
  for (const k of Object.keys(localStorage)) {
    if (/^stratos\.supabase/i.test(k))   localStorage.removeItem(k);
    else if (/-code-verifier$/i.test(k)) localStorage.removeItem(k);
    else if (/^sb-.*-pkce$/i.test(k))    localStorage.removeItem(k);
  }
} catch (_) { /* localStorage bloqueado — ignorar */ }

// ─── AUTO-RECOVERY: chunk viejo tras un deploy ──────────────────────────────
// Cada deploy cambia el hash de los chunks (assets/App-XXXX.js). Una pestaña
// abierta durante el deploy intenta lazy-importar el chunk viejo, Vercel ya
// no lo tiene y el usuario veía "⚠️ Algo salió mal / Importing a module
// script failed". Vite emite `vite:preloadError` justo en ese caso: recargamos
// una vez para tomar el index.html nuevo (con los hashes nuevos). El guard en
// sessionStorage evita un bucle de recargas si el fallo fuera por red caída.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault(); // que el import fallido no reviente el árbol: nos encargamos nosotros
  recoverFromStaleChunk(); // escala: reload suave y, si no alcanza, limpieza dura de cachés/SW
});

// ─── DECISIÓN DE EXPERIENCIA ─────────────────────────────────────────────────
// LÓGICA: mostrar Landing SOLO en los dominios públicos conocidos.
// Todo lo demás (Vercel, subdominio app., localhost con ?app) → Plataforma.
const hostname = window.location.hostname;
const params   = new URLSearchParams(window.location.search);
const pathname = window.location.pathname;

const LANDING_DOMAINS = [
  "stratoscapitalgroup.com",
  "www.stratoscapitalgroup.com",
];

// Rutas públicas legales — accesibles desde cualquier dominio sin auth
const PRIVACY_PATHS = ["/politica-de-privacidad", "/privacy-policy"];
const DELETION_PATHS = ["/eliminar-mis-datos", "/data-deletion"];
// Hub de entrega del CRM — público, sin login. Compartido con socios/fundadores
// para que entiendan qué se les entregó y qué viene después.
const DELIVERY_PATHS = ["/entrega-crm", "/entrega"];
// Manual operativo del CRM — público, para asesores. Diseñado para que un agente
// IA de soporte futuro consuma window.__STRATOS_MANUAL__ y dé respuestas RAG.
const MANUAL_PATHS = ["/manual", "/manual-crm"];
// Manual del ASISTENTE DE TELEGRAM — público, para asesores (uso del bot).
const MANUAL_TG_PATHS = ["/manual-asistente-telegram", "/manual_asistente_telegram", "/manual-telegram"];
const DIAGNOSTICO_PATHS = ["/diagnostico"];
const matchPath = (paths) => paths.some(p => pathname === p || pathname === p + "/");
const isPrivacy = matchPath(PRIVACY_PATHS);
const isDeletion = matchPath(DELETION_PATHS);
const isDelivery = matchPath(DELIVERY_PATHS);
const isManual = matchPath(MANUAL_PATHS);
const isManualTG = matchPath(MANUAL_TG_PATHS);
// /diagnostico (formulario público) y /diagnostico/view/<lead_id> (vista compartida
// del Blueprint que vio el cliente — el link llega al equipo por Telegram al
// crearse cada lead). Ambas se renderean con el mismo componente Diagnostico.jsx,
// que detecta la URL y decide si pinta el wizard o salta directo al reporte.
const isDiagnosticoView = /^\/diagnostico\/view\/[A-Za-z0-9-]+\/?$/.test(pathname);
const isDiagnostico = matchPath(DIAGNOSTICO_PATHS) || isDiagnosticoView;

// Landing personalizada para el CLIENTE FINAL — pública, sin login. El asesor
// la genera en el Marketing Studio (Create) y comparte /p#d=<payload>. Todo va
// en la URL; PublicLanding la decodifica. Nunca expone datos internos del CRM.
const isPublicLanding = pathname === "/p" || pathname === "/p/" || /^\/p\/[A-Za-z0-9_-]{4,32}\/?$/.test(pathname);

// ─── RESOLUCIÓN DE CLIENTE (multi-tenant) ────────────────────────────────────
// Se detecta el cliente activo según hostname/path:
//   · grupo28.stratoscapitalgroup.com  o  /grupo28   →  cliente "grupo28"
//   · cualquier otra cosa                            →  cliente "duke" (default)
// Si el path matchea un cliente explícito (no-default), forzamos isApp=true:
// esto permite entrar a `/grupo28` sin necesidad de `?app` en localhost.
const clientId        = matchClientFromLocation(window.location);
const clientConfig    = resolveClientFromLocation(window.location);
const isExplicitClient = clientId !== "duke";

const isLanding = !isExplicitClient && (
  LANDING_DOMAINS.includes(hostname)
  || (hostname === "localhost" && !params.has("app"))
  || (hostname === "127.0.0.1" && !params.has("app"))
);

const isApp = !isPrivacy && !isDeletion && !isDelivery && !isManual && !isManualTG && !isDiagnostico && !isPublicLanding && !isLanding;

// URL de la plataforma — usada por la landing para el CTA principal
const APP_URL = import.meta.env.VITE_APP_URL || (window.location.origin + "/?app");

// ─── BRANDING POR CLIENTE ────────────────────────────────────────────────────
// Cambio mínimo y observable: título de la pestaña + atributo en <html>.
// Componentes específicos del CRM pueden leer más config via useClient().
try {
  if (clientConfig?.name) {
    document.title = isApp
      ? `${clientConfig.name} — Plataforma`
      : clientConfig.name;
  }
  document.documentElement.setAttribute("data-client", clientId);
} catch (_) { /* SSR / DOM no disponible */ }

// ─── SILENCIADOR DE WARNINGS NO FATALES EN CONSOLA (Recharts & Tailwind CDN) ───
try {
  const origError = console.error;
  const origWarn = console.warn;
  console.error = (...args) => {
    const msg = args.join(' ');
    if (msg.includes('width(-1)') || msg.includes('height(-1)') || msg.includes('ResponsiveContainer')) return;
    origError.apply(console, args);
  };
  console.warn = (...args) => {
    const msg = args.join(' ');
    if (msg.includes('cdn.tailwindcss.com') || msg.includes('should not be used in production')) return;
    origWarn.apply(console, args);
  };
} catch (_) {}

// ─── RENDER ───────────────────────────────────────────────────────────────────
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <ClientProvider config={clientConfig}>
        <AuthProvider>
          {/* Watcher: si el user logueado pertenece a otra org, redirige al
              path correcto. Solo activo cuando isApp=true porque las páginas
              públicas (privacy, deletion, etc.) no necesitan este guardrail. */}
          {isApp && <ClientOrgGuard />}
          <Suspense fallback={null}>
            {isPublicLanding
              ? <PublicLanding />
              : isPrivacy
              ? <PrivacyPolicy />
              : isDeletion
                ? <DataDeletion />
                : isDelivery
                  ? <DeliveryHubCRM />
                  : isManual
                    ? <ManualCRM />
                    : isManualTG
                      ? <ManualCRM
                          sections={MANUAL_SECTIONS_TG}
                          categories={CATEGORIES_TG}
                          search={searchManualTG}
                          navLabel="Asistente de Telegram"
                          docTitle="Manual del Asistente de Telegram · Stratos AI"
                          docDesc="Cómo usar tu asistente de Telegram del CRM Duke del Caribe: conectar, qué pedirle, recordatorios automáticos, acciones de equipo y funciones de admin."
                          footerLabel="Asistente de Telegram v1.0"
                          waNumber="5219842803001"
                          waText="Hola, necesito ayuda con el asistente de Telegram"
                        />
                      : isDiagnostico
                        ? <Diagnostico />
                      : isApp
                        ? <App />
                        : <LandingMarketing appUrl={APP_URL} />
            }
          </Suspense>
        </AuthProvider>
      </ClientProvider>
    </ErrorBoundary>
  </StrictMode>
);

// ─── SERVICE WORKER ─────────────────────────────────────────────────────────
// Registramos el SW en producción y en preview. NO en dev (puerto 5173) porque
// el HMR de Vite se vuelve impredecible cuando el SW intercepta requests.
//
// Beneficios:
//   · App carga sin internet (cache-first del shell)
//   · Instalable como app nativa en celular (Add to Home Screen)
//   · Datos seed offline siempre disponibles
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" })
      .then(reg => {
        // Si hay un SW esperando, lo activamos inmediatamente
        if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
        reg.addEventListener("updatefound", () => {
          const next = reg.installing;
          if (!next) return;
          next.addEventListener("statechange", () => {
            if (next.state === "installed" && navigator.serviceWorker.controller) {
              next.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      })
      .catch(err => console.warn("[Stratos] SW registro falló:", err));

    // Cuando el SW nuevo toma control, recargar para usar la última versión
    let refreshing = false;
    // ¿La página YA estaba controlada por un SW al cargar? En la PRIMERA carga
    // (o en incógnito) NO lo está: el SW recién se instala y "reclama" la página,
    // lo que dispara controllerchange/SW_UPDATED. Pero en esa primera carga el
    // bundle que ya bajó ES el más nuevo (vino de la red) → recargar es
    // INNECESARIO. Ese reload de la primera visita era el "recorte" a los ~3s
    // (se reiniciaba toda la página, ícono incluido). Solo recargamos cuando SÍ
    // estábamos controlados = update real (se reemplaza un SW viejo por uno nuevo
    // y hay que bajar el bundle nuevo). El guard anti-loop de iOS se conserva.
    const wasControlledAtLoad = !!navigator.serviceWorker.controller;
    const forceReload = () => {
      if (!wasControlledAtLoad) return; // primera carga: ya tenemos el bundle nuevo
      if (refreshing) return;
      // Guard CROSS-RELOAD (fix loop iOS "Ocurrió un problema varias veces"):
      // el flag `refreshing` vive solo en memoria y se reinicia al recargar. En
      // iOS Safari, controllerchange/SW_UPDATED puede dispararse en CADA carga →
      // reload → loop infinito. Sumamos un guard por sessionStorage: si ya
      // recargamos por el SW hace <30s, NO recargamos otra vez (corta el loop),
      // pero permite updates legítimos más tarde en la misma sesión.
      try {
        const last = +(sessionStorage.getItem("stratos_sw_reload_at") || 0);
        if (last && Date.now() - last < 30000) return;
        sessionStorage.setItem("stratos_sw_reload_at", String(Date.now()));
      } catch (_) { /* sessionStorage bloqueado → queda el guard en memoria */ }
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", forceReload);
    // Backup: el SW también nos manda un postMessage en activate. Si por
    // alguna razón controllerchange no se dispara (ej. la página ya estaba
    // controlada por una versión vieja del SW), este listener lo cubre.
    navigator.serviceWorker.addEventListener("message", (evt) => {
      // Refuerzo: si el SW v10+ avisa, limpiamos tokens huérfanos antes del
      // reload. Cubre el caso en que el cleanup síncrono del boot guard no
      // haya alcanzado a correr porque el bundle viejo ya estaba en memoria.
      if (evt.data?.type === "PURGE_LEGACY_AUTH") {
        try {
          for (const k of Object.keys(localStorage)) {
            if (/^stratos\.supabase/i.test(k)) localStorage.removeItem(k);
          }
        } catch (_) { /* noop */ }
      }
      if (evt.data?.type === "SW_UPDATED") forceReload();
    });
  });
}
