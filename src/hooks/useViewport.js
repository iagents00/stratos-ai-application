/**
 * hooks/useViewport.js
 *
 * Hook único para detectar tamaño de pantalla. Lo usan los componentes del
 * CRM (drawers, listas, modales) para adaptar su layout: bottom-sheet en
 * móvil vs side-drawer en desktop, lista de cards vs tabla, etc.
 *
 * Breakpoints alineados con el shell de App.jsx (.stratos-bottomnav usa 768).
 *   · mobile   < 768
 *   · tablet   768–1023
 *   · desktop  ≥ 1024
 *
 * Hidratación SSR-safe: en el primer render `window` puede no existir,
 * usamos un fallback de desktop para evitar layout-shift en escritorio.
 * En el efecto sincronizamos el valor real y suscribimos resize.
 */
import { useEffect, useState } from "react";

const MOBILE_MAX  = 768;   // <= 768 → mobile (alineado con @media max-width:768px)
const TABLET_MAX  = 1024;  // < 1024 → tablet (incluye iPad portrait)
const PHONE_SCREEN_MAX = 500; // lado corto FÍSICO de un teléfono (iPhone Pro Max ~440); tablets ≥768

/**
 * ¿El aparato es FÍSICAMENTE un teléfono (táctil + pantalla chica), aunque el
 * navegador reporte un ancho de ESCRITORIO?  En un iPhone, `window.innerWidth`
 * puede inflarse por encima de 768 por: Safari en "Solicitar sitio para
 * computadora", un <meta viewport> viejo/ausente en el HTML cacheado del ícono
 * de inicio (iOS cae a 980px), o el zoom de página al 50%. En esos casos, sin
 * este blindaje, la app caía al layout de ESCRITORIO en un celular (le pasó a
 * Iván, no a Ángel). El LADO CORTO físico de la pantalla (`min` de screen) NO
 * lo cambian esos modos: ≤500px separa limpio los teléfonos de tablets/PC.
 */
export const isPhoneHardware = () => {
  if (typeof window === "undefined") return false;
  try {
    const touch = (navigator.maxTouchPoints || 0) > 0 ||
      (typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches);
    const scr = window.screen || {};
    const minSide = Math.min(scr.width || Infinity, scr.height || Infinity);
    return !!touch && minSide > 0 && minSide <= PHONE_SCREEN_MAX;
  } catch { return false; }
};

const getViewport = () => {
  if (typeof window === "undefined") {
    return { width: 1280, isMobile: false, isTablet: false, isDesktop: true };
  }
  const w = window.innerWidth;
  // isMobile por ANCHO (comportamiento de siempre, intacto para PC y para el
  // celular sano en vertical) O por HARDWARE de teléfono (blindaje: un iPhone
  // que reporta ancho de escritorio igual entra al layout móvil). Cuando
  // isMobile gana por hardware, tablet/desktop quedan en false (excluyentes).
  const isMobile = w <= MOBILE_MAX || isPhoneHardware();
  return {
    width: w,
    isMobile,
    isTablet:  !isMobile && w < TABLET_MAX,
    isDesktop: !isMobile && w >= TABLET_MAX,
  };
};

export function useViewport() {
  const [vp, setVp] = useState(getViewport);

  useEffect(() => {
    let timer;
    const onResize = () => {
      // Debounce 80ms — evita re-renders durante el drag de la ventana.
      clearTimeout(timer);
      timer = setTimeout(() => setVp(getViewport()), 80);
    };
    onResize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  return vp;
}

/**
 * Conveniencia: solo el flag de mobile, para componentes que solo necesitan
 * cambiar entre layouts mobile/desktop sin diferenciar tablet.
 */
export function useIsMobile() {
  return useViewport().isMobile;
}
