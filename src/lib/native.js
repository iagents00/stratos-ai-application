/**
 * lib/native.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Detección de plataforma nativa (Capacitor) — fuente única de verdad.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO:
 * La misma base de código sirve tres targets:
 *   · Web  (Vercel)      → stratoscapitalgroup.com, app.stratoscapitalgroup.com
 *   · iOS  (Capacitor)   → corre desde capacitor://localhost dentro de WKWebView
 *   · Android (futuro)   → http://localhost
 *
 * En iOS el WebView reporta hostname === "localhost". Eso colisiona con la
 * heurística de main.jsx que trata "localhost" como entorno de desarrollo y
 * muestra la LANDING DE MARKETING. Sin este guard, la app del App Store abriría
 * la página de ventas en lugar del CRM. Ver isLanding en main.jsx.
 *
 * Se lee en tiempo de módulo (no es un hook) porque main.jsx lo necesita ANTES
 * de montar React, en la misma pasada donde decide qué experiencia renderizar.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { Capacitor } from "@capacitor/core";

/** true solo dentro del contenedor nativo (iOS/Android). En web siempre false. */
export const isNative = Capacitor.isNativePlatform();

/** "ios" | "android" | "web" */
export const nativePlatform = Capacitor.getPlatform();

export const isIOS     = nativePlatform === "ios";
export const isAndroid = nativePlatform === "android";

/**
 * En nativo no hay path ni subdominio que identifique al cliente (siempre es
 * capacitor://localhost/). El tenant se resuelve DESPUÉS del login, a partir de
 * user.organizationId — ver ClientOrgGuard.
 */
export const resolvesTenantByUrl = !isNative;
