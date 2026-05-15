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
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AuthProvider }   from "./contexts/AuthContext";
import { ClientProvider } from "./contexts/ClientContext";
import { ClientOrgGuard } from "./contexts/ClientOrgGuard";
import { resolveClientFromLocation, matchClientFromLocation } from "./clients";
import ErrorBoundary   from "./components/ErrorBoundary.jsx";
import App            from "./app/App.jsx";
import LandingMarketing from "./landing/LandingMarketing.jsx";
import PrivacyPolicy   from "./landing/PrivacyPolicy.jsx";
import DataDeletion    from "./landing/DataDeletion.jsx";
import DeliveryHubCRM  from "./landing/DeliveryHubCRM.jsx";
import ManualCRM       from "./landing/ManualCRM.jsx";

import "./index.css";

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
const matchPath = (paths) => paths.some(p => pathname === p || pathname === p + "/");
const isPrivacy = matchPath(PRIVACY_PATHS);
const isDeletion = matchPath(DELETION_PATHS);
const isDelivery = matchPath(DELIVERY_PATHS);
const isManual = matchPath(MANUAL_PATHS);

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

const isApp = !isPrivacy && !isDeletion && !isDelivery && !isManual && !isLanding;

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
          {isPrivacy
            ? <PrivacyPolicy />
            : isDeletion
              ? <DataDeletion />
              : isDelivery
                ? <DeliveryHubCRM />
                : isManual
                  ? <ManualCRM />
                  : isApp
                    ? <App />
                    : <LandingMarketing appUrl={APP_URL} />
          }
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
    const forceReload = () => {
      if (refreshing) return;
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
