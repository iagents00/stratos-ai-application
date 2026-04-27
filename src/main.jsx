/**
 * main.jsx — Entry point de Stratos IA
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

import { AuthProvider } from "./contexts/AuthContext";
import ErrorBoundary   from "./components/ErrorBoundary.jsx";
import App            from "./app/App.jsx";
import LandingMarketing from "./landing/LandingMarketing.jsx";
import { initDevMonitor } from "./lib/dev-monitor";
import { getOfflineSession } from "./lib/offline-mode";

import "./index.css";

// ─── DECISIÓN DE EXPERIENCIA ─────────────────────────────────────────────────
// LÓGICA: mostrar Landing SOLO en los dominios públicos conocidos.
// Todo lo demás (Vercel, subdominio app., localhost con ?app) → Plataforma.
const hostname = window.location.hostname;
const params   = new URLSearchParams(window.location.search);

const LANDING_DOMAINS = [
  "stratoscapitalgroup.com",
  "www.stratoscapitalgroup.com",
];

const isLanding = LANDING_DOMAINS.includes(hostname)
               || (hostname === "localhost" && !params.has("app"))
               || (hostname === "127.0.0.1" && !params.has("app"));

const isApp = !isLanding;

// URL de la plataforma — usada por la landing para el CTA principal
const APP_URL = import.meta.env.VITE_APP_URL || (window.location.origin + "/?app");

// ─── DEV MONITOR ─────────────────────────────────────────────────────────────
// Captura errores globales y los envía a Telegram para que el equipo dev
// se entere antes que los usuarios. Solo activo si VITE_TELEGRAM_BOT_TOKEN
// está configurado en Vercel. Ver src/lib/dev-monitor.js para setup.
initDevMonitor(() => {
  // Devuelve contexto del usuario actual para los reportes de error
  const session = getOfflineSession();
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem("stratos_session_cache") || "null")?.profile; }
  catch (_) { /* noop */ }
  const u = session || stored;
  return { userEmail: u?.email, userRole: u?.role };
});

// ─── RENDER ───────────────────────────────────────────────────────────────────
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        {isApp
          ? <App />
          : <LandingMarketing appUrl={APP_URL} />
        }
      </AuthProvider>
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
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}
