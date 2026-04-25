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
import App            from "./app/App.jsx";
import LandingMarketing from "./landing/LandingMarketing.jsx";

import "./index.css";

// ─── DECISIÓN DE EXPERIENCIA ─────────────────────────────────────────────────
const hostname = window.location.hostname;
const params   = new URLSearchParams(window.location.search);
const isApp    = hostname.startsWith("app.")
              || params.has("app")
              || import.meta.env.VITE_IS_APP === "true";

// URL de la plataforma — usada por la landing para el CTA principal
const APP_URL  = import.meta.env.VITE_APP_URL || "http://localhost:5173/?app";

// ─── RENDER ───────────────────────────────────────────────────────────────────
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      {isApp
        ? <App />
        : <LandingMarketing appUrl={APP_URL} />
      }
    </AuthProvider>
  </StrictMode>
);
