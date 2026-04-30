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

const MOBILE_MAX  = 768;   // < 768 → mobile
const TABLET_MAX  = 1024;  // < 1024 → tablet (incluye iPad portrait)

const getViewport = () => {
  if (typeof window === "undefined") {
    return { width: 1280, isMobile: false, isTablet: false, isDesktop: true };
  }
  const w = window.innerWidth;
  return {
    width: w,
    isMobile:  w < MOBILE_MAX,
    isTablet:  w >= MOBILE_MAX && w < TABLET_MAX,
    isDesktop: w >= TABLET_MAX,
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
