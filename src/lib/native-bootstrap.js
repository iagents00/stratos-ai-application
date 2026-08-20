/**
 * lib/native-bootstrap.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Inicialización del contenedor nativo (iOS/Android). No-op en web.
 *
 * Se llama UNA vez desde main.jsx, después de montar React. Todo lo de aquí es
 * cosmético o de UX del shell — ninguna lógica de negocio depende de esto, así
 * que si un plugin falla la app sigue funcionando igual.
 *
 * ⚠️ NO TOCA AUTH. La sesión de Supabase sigue viviendo en localStorage con la
 * config exacta descrita en ZONA CRÍTICA — CONFIG DE AUTH ESTABLE (CLAUDE.md).
 * En WKWebView con contenido servido por la app, localStorage persiste igual
 * que en web, así que no hay razón para meter un storage adapter nativo y sí
 * mucho riesgo de reabrir el bug de "Conectando con el servidor…".
 *
 * Los imports son dinámicos a propósito: el bundle web no arrastra el código
 * de los plugins nativos.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { isNative } from "./native";

export async function initNative() {
  if (!isNative) return;

  // ── Barra de estado ───────────────────────────────────────────────────────
  // Style.Dark = "fondo oscuro" → iOS dibuja la hora y los iconos en BLANCO.
  // Es lo correcto sobre el #060A11 de la app (el naming del plugin confunde).
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
  } catch (err) {
    console.warn("[Stratos] StatusBar no disponible:", err?.message || err);
  }

  // ── Teclado ───────────────────────────────────────────────────────────────
  // Exponemos la altura del teclado como CSS var para que los formularios del
  // CRM (alta de lead, notas) puedan levantar sus botones y no queden tapados.
  try {
    const { Keyboard } = await import("@capacitor/keyboard");
    const setKb = (px) =>
      document.documentElement.style.setProperty("--kb-height", `${px}px`);
    setKb(0);
    Keyboard.addListener("keyboardWillShow", (info) => setKb(info?.keyboardHeight ?? 0));
    Keyboard.addListener("keyboardWillHide", () => setKb(0));
  } catch (err) {
    console.warn("[Stratos] Keyboard no disponible:", err?.message || err);
  }

  // ── Estado de la app ──────────────────────────────────────────────────────
  // Al volver del background disparamos el mismo evento que ya escucha App.jsx
  // para revalidar datos. Reusamos "visibilitychange" en lugar de inventar un
  // canal nuevo: la lógica de refetch ya está escrita y probada contra él.
  try {
    const { App: CapApp } = await import("@capacitor/app");
    CapApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) document.dispatchEvent(new Event("visibilitychange"));
    });
  } catch (err) {
    console.warn("[Stratos] App plugin no disponible:", err?.message || err);
  }

  // ── Splash ────────────────────────────────────────────────────────────────
  // Se oculta al final, cuando el shell ya está pintado. Si algo de arriba
  // falla igual llegamos acá: nunca dejamos la splash colgada.
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch (err) {
    console.warn("[Stratos] SplashScreen no disponible:", err?.message || err);
  }
}
