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
import { StrictMode, lazy, Suspense, useEffect } from "react";
import { createRoot } from "react-dom/client";

import { AuthProvider }   from "./contexts/AuthContext";
import { ClientProvider } from "./contexts/ClientContext";
import { ClientOrgGuard } from "./contexts/ClientOrgGuard";
import { resolveClientFromLocation, matchClientFromLocation } from "./clients";
import ErrorBoundary   from "./components/ErrorBoundary.jsx";
import UpdatePill      from "./components/UpdatePill.jsx";
import { recoverFromStaleChunk } from "./lib/chunk-recovery.js";
import { isNativeApp } from "./lib/native";

// Code-splitting: solo se carga el bundle de la experiencia que el usuario
// realmente abrió. Antes este import era estático y arrastraba todo a 922KB.
const App              = lazy(() => import("./app/App.jsx"));
const LandingMarketing = lazy(() => import("./landing/LandingMarketing.jsx"));
const PrivacyPolicy    = lazy(() => import("./landing/PrivacyPolicy.jsx"));
const PublicLanding    = lazy(() => import("./app/views/LandingPages/PublicLanding.jsx"));
const DataDeletion     = lazy(() => import("./landing/DataDeletion.jsx"));
const DeliveryHubCRM   = lazy(() => import("./landing/DeliveryHubCRM.jsx"));
const ManualCRM        = lazy(() => import("./landing/ManualCRM.jsx"));
const ManualMarketing  = lazy(() => import("./landing/ManualMarketing.jsx"));
const ManualNSG        = lazy(() => import("./landing/ManualNSG.jsx"));
const ManualLegacy     = lazy(() => import("./landing/ManualLegacy.jsx"));
const ManualBrasa      = lazy(() => import("./landing/ManualBrasa.jsx"));
const ManualGasil      = lazy(() => import("./landing/ManualGasil.jsx"));
const ManualMuebleria  = lazy(() => import("./landing/ManualMuebleria.jsx"));
const Diagnostico      = lazy(() => import("./landing/Diagnostico.jsx"));
const DukeLeadRouter   = lazy(() => import("./landing/DukeLeadRouter.jsx"));
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

// ─── SHELL NATIVO ────────────────────────────────────────────────────────────
// Marca el <html> cuando la web corre dentro de la app de Capacitor (mobile/),
// para que index.css pueda aplicar reglas que SOLO tienen sentido en WebView.
// Se hace acá y no en index.css porque no hay media query que detecte "app".
//
// Por qué importa: el shell carga esta MISMA web remota, así que este ajuste
// llega a la app por Vercel, sin recompilar ni resubir el binario.
//
// El bridge se inyecta antes de los scripts de la página, pero si por timing
// no estuviera, reintentamos en load — barato y sin efectos secundarios.
function marcarShellNativo() {
  try {
    if (isNativeApp()) document.documentElement.classList.add("stratos-native");
  } catch { /* noop */ }
}
marcarShellNativo();
window.addEventListener("load", marcarShellNativo, { once: true });

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
// Manual del EQUIPO DE MARKETING (módulo Mi Espacio + Copilot de marketing) — público.
const MANUAL_MKT_PATHS = ["/manual-marketing", "/manual-mkt"];
// Manual de uso de Stratos IA para NSG (Iván, Ángel y quien entre nuevo) — público,
// para poder linkearlo desde "Documentos del Equipo" y mandarlo por chat.
const MANUAL_NSG_PATHS = ["/manual-nsg", "/manual-stratos-nsg"];
// Manual de uso de Stratos para LEGACY DESIGN (Shadai, Mario y su equipo) — público,
// en el lenguaje de la obra, linkeable desde sus Documentos y desde el Copilot.
const MANUAL_LEGACY_PATHS = ["/manual-legacy", "/manual-legacy-design"];
// Manual de uso de Stratos para BRASA Y PIEDRA (restaurante) — público, tono cercano.
const MANUAL_BRASA_PATHS = ["/manual-brasa", "/manual-brasa-y-piedra"];
// Manual de uso de Stratos para GASIL RADIODIAGNÓSTICO DEL VALLE (centro de
// imagen) — público, para recepción y técnicos.
const MANUAL_GASIL_PATHS = ["/manual-gasil", "/manual-gasil-radiodiagnostico"];
// Manual de uso de Stratos para MUEBLARIA (mobiliario a medida) — público, en el
// lenguaje del taller: los carpinteros no viven frente a una computadora.
const MANUAL_MUEBLERIA_PATHS = ["/manual-muebleria", "/manual-mueblaria"];
const DIAGNOSTICO_PATHS = ["/diagnostico"];
// Landing pública de Duke del Caribe — destino de la pantalla final del formulario
// instantáneo de Meta (campaña "Desarrollos desde USD 97K"). Sin login, sin app.
const DUKE_LEAD_ROUTER_PATHS = ["/duke/desarrollos-97k", "/duke-100k", "/desarrollos-97k", "/duke-97k"];
const matchPath = (paths) => paths.some(p => pathname === p || pathname === p + "/");
const isPrivacy = matchPath(PRIVACY_PATHS);
const isDeletion = matchPath(DELETION_PATHS);
const isDelivery = matchPath(DELIVERY_PATHS);
const isManual = matchPath(MANUAL_PATHS);
const isManualTG = matchPath(MANUAL_TG_PATHS);
const isManualMkt = matchPath(MANUAL_MKT_PATHS);
const isManualNSG = matchPath(MANUAL_NSG_PATHS);
const isManualLegacy = matchPath(MANUAL_LEGACY_PATHS);
const isManualBrasa = matchPath(MANUAL_BRASA_PATHS);
const isManualGasil = matchPath(MANUAL_GASIL_PATHS);
const isManualMuebleria = matchPath(MANUAL_MUEBLERIA_PATHS);
// /diagnostico (formulario público) y /diagnostico/view/<lead_id> (vista compartida
// del Blueprint que vio el cliente — el link llega al equipo por Telegram al
// crearse cada lead). Ambas se renderean con el mismo componente Diagnostico.jsx,
// que detecta la URL y decide si pinta el wizard o salta directo al reporte.
const isDiagnosticoView = /^\/diagnostico\/view\/[A-Za-z0-9-]+\/?$/.test(pathname);
const isDiagnostico = matchPath(DIAGNOSTICO_PATHS) || isDiagnosticoView;
const isDukeLeadRouter = matchPath(DUKE_LEAD_ROUTER_PATHS);

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

const isApp = !isPrivacy && !isDeletion && !isDelivery && !isManual && !isManualTG && !isManualMkt && !isManualNSG && !isManualLegacy && !isManualBrasa && !isManualGasil && !isManualMuebleria && !isDiagnostico && !isDukeLeadRouter && !isPublicLanding && !isLanding;

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

// ─── LA APP INSTALADA ABRE EN SU EMPRESA (13-ago-2026) ───────────────────────
// Qué arregla, reportado desde un iPhone:
//   «Agregar a inicio» guardaba SIEMPRE el nombre «Stratos AI» y, peor, el
//   ícono abría SIEMPRE la raíz — que cae en la config de Duke. Quien instalaba
//   desde /nsg terminaba viendo la marca y las etapas de Duke. Parecía que la
//   app «había vuelto a una versión vieja»; era la puerta equivocada.
//
// Causa: el manifest es UNO solo y estático, con `start_url: "/"` y el nombre
// fijo. Un archivo para once empresas.
//
// Arreglo: al arrancar se arma el manifest de ESTA empresa —su nombre y su
// dirección de inicio— y se reemplaza el estático. Si algo falla queda el de
// siempre, así que nunca se pierde la posibilidad de instalar.
try {
  if (isApp && clientConfig?.name) {
    const nombre = clientConfig.name;

    // 1) El nombre que iOS escribe debajo del ícono.
    let metaTitulo = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (!metaTitulo) {
      metaTitulo = document.createElement("meta");
      metaTitulo.setAttribute("name", "apple-mobile-web-app-title");
      document.head.appendChild(metaTitulo);
    }
    metaTitulo.setAttribute("content", nombre);

    // 2) El manifest de esta empresa. `start_url` apunta a SU dirección, así
    //    que el ícono instalado abre donde se instaló y no en la raíz.
    const inicio = clientId === "duke" ? "/" : `/${clientId}`;
    const linkManifest = document.querySelector('link[rel="manifest"]');
    if (linkManifest) {
      const manifest = {
        name: `${nombre} — Plataforma`,
        short_name: nombre,
        description: `Sistema de ${nombre}.`,
        lang: "es-MX",
        dir: "ltr",
        start_url: inicio,
        scope: "/",
        display: "standalone",
        orientation: "any",
        background_color: "#030810",
        theme_color: "#030810",
        categories: ["business", "productivity"],
        icons: [
          { src: "/icon-192.png",     sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png",     sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      };
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" })
      );
      linkManifest.setAttribute("href", url);
    }
  }
} catch (_) { /* si falla, queda el manifest estático de siempre */ }

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

// ─── SEÑAL DE ARRANQUE ───────────────────────────────────────────────────────
// [guard:BOOT-HEALTH] Le avisa a los vigilantes de index.html que React MONTÓ.
// Antes esos vigilantes miraban si <div id="root"> tenía hijos — y root queda
// VACÍO a propósito mientras carga el chunk de la app (`<Suspense fallback={null}>`).
// O sea: confundían "está arrancando" con "se colgó" y recargaban una app que
// venía perfecta. Va FUERA del <Suspense> para avisar apenas React commitea,
// sin esperar al chunk grande. (Si el chunk grande falla, de eso se encarga
// `vite:preloadError` + ErrorBoundary, que es su trabajo.)
function BootSignal() {
  useEffect(() => {
    try {
      window.__STRATOS_BOOT__ = 1;
      document.documentElement.setAttribute("data-app-mounted", "1");
      window.dispatchEvent(new Event("stratos:mounted"));
    } catch (_) { /* noop */ }
  }, []);
  return null;
}

// ─── RENDER ───────────────────────────────────────────────────────────────────
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BootSignal />
    <ErrorBoundary>
      <ClientProvider config={clientConfig}>
        <AuthProvider>
          {/* Watcher: si el user logueado pertenece a otra org, redirige al
              path correcto. Solo activo cuando isApp=true porque las páginas
              públicas (privacy, deletion, etc.) no necesitan este guardrail. */}
          {isApp && <ClientOrgGuard />}
          {/* Aviso de versión nueva. Se pinta SOLO dentro de la app nativa y
              solo cuando el servidor sirve un bundle distinto al que corre.
              Nunca recarga solo: la recarga la toca el usuario (ver #594). */}
          {isApp && <UpdatePill />}
          <Suspense fallback={null}>
            {isPublicLanding
              ? <PublicLanding />
              : isPrivacy
              ? <PrivacyPolicy />
              : isDeletion
                ? <DataDeletion />
                : isDelivery
                  ? <DeliveryHubCRM />
                  : isManualNSG
                    ? <ManualNSG />
                  : isManualLegacy
                    ? <ManualLegacy />
                  : isManualBrasa
                    ? <ManualBrasa />
                  : isManualGasil
                    ? <ManualGasil />
                  : isManualMuebleria
                    ? <ManualMuebleria />
                  : isManualMkt
                    ? <ManualMarketing />
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
                      : isDukeLeadRouter
                        ? <DukeLeadRouter />
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
//
// ⚠️ ACÁ NO SE RECARGA LA PÁGINA. NUNCA. (fix 05-ago-2026)
// Hasta ago-2026, cuando el SW se actualizaba (o sea: en CADA deploy, y
// desplegamos ~3 veces por día) esta sección hacía `window.location.reload()`.
// Eso era el primer eslabón del "se recarga varias veces solo al abrir":
//   1. Abrís la app → llega el index.html nuevo → el SW nuevo se instala,
//      activa y reclama la página → reload #1, tirando a la basura el bundle
//      que ACABABA de bajar.
//   2. La recarga arranca con el caché recién vaciado → tarda más → los
//      vigilantes de arranque (index.html) la daban por colgada → reload #2 y #3.
// Y era una recarga INÚTIL: la navegación es network-first, así que el HTML que
// el usuario ya tenía en pantalla ERA el nuevo, con los chunks nuevos. La
// versión nueva entra sola en la próxima navegación, como en cualquier app.
// El caso "pestaña vieja pide un chunk que ya no existe" lo cubre
// `vite:preloadError` acá arriba. Revertir = volver a poner el forceReload.
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

    navigator.serviceWorker.addEventListener("message", (evt) => {
      // Limpieza de tokens huérfanos de versiones viejas. Cubre el caso en que
      // el cleanup síncrono del boot guard no haya alcanzado a correr porque el
      // bundle viejo ya estaba en memoria. No recarga nada.
      if (evt.data?.type === "PURGE_LEGACY_AUTH") {
        try {
          for (const k of Object.keys(localStorage)) {
            if (/^stratos\.supabase/i.test(k)) localStorage.removeItem(k);
          }
        } catch (_) { /* noop */ }
      }
    });
  });
}
