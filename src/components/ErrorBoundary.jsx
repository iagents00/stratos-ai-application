/**
 * components/ErrorBoundary.jsx
 * React Error Boundary — captura errores de render y los muestra limpiamente
 * en vez de dejar la pantalla en blanco.
 */
import { Component } from "react";

// Detecta el fallo de "chunk viejo tras deploy": el hash del asset cambió y
// el lazy import pide un archivo que ya no existe en Vercel. Los mensajes
// varían por navegador (Safari: "Importing a module script failed", Chrome:
// "Failed to fetch dynamically imported module", Firefox: "error loading
// dynamically imported module").
const isStaleChunkError = (error) =>
  /importing a module script failed|dynamically imported module|chunkloaderror|loading chunk/i
    .test(error?.message || "");

// Mismo guard anti-bucle que el listener vite:preloadError de main.jsx:
// recargamos máximo una vez por minuto; si sigue fallando (red caída), se
// muestra la pantalla de error normal.
const reloadOnceForStaleChunk = () => {
  const GUARD_KEY = "stratos.chunk.reloaded.at";
  let last = 0;
  try { last = Number(sessionStorage.getItem(GUARD_KEY) || 0); } catch (_) { /* noop */ }
  if (Date.now() - last < 60_000) return false;
  try { sessionStorage.setItem(GUARD_KEY, String(Date.now())); } catch (_) { /* noop */ }
  window.location.reload();
  return true;
};

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Chunk viejo tras un deploy → recargar toma el index.html nuevo con los
    // hashes nuevos. Auto-recovery silencioso; el usuario no debe ver esto.
    if (isStaleChunkError(error) && reloadOnceForStaleChunk()) return;
    // En producción puedes enviar este error a Sentry / LogRocket aquí
    console.error("[Stratos ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const { fallback } = this.props;
    if (fallback) return fallback;

    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "#060A11",
        color: "#E2E8F0",
        fontFamily: `-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif`,
        gap: 16,
        padding: 32,
        textAlign: "center",
      }}>
        <div style={{ fontSize: 40 }}>⚠️</div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
          Algo salió mal
        </h2>
        <p style={{ margin: 0, color: "#8B99AE", fontSize: 14, maxWidth: 420 }}>
          {this.state.error?.message || "Error inesperado en la aplicación."}
        </p>
        <button
          onClick={() => {
            // Con chunk viejo, re-render volvería a pedir el mismo archivo
            // inexistente: la única salida real es recargar.
            if (isStaleChunkError(this.state.error)) { window.location.reload(); return; }
            this.setState({ hasError: false, error: null });
          }}
          style={{
            marginTop: 8,
            padding: "10px 24px",
            background: "rgba(110,231,194,0.12)",
            border: "1px solid rgba(110,231,194,0.3)",
            borderRadius: 8,
            color: "#6EE7C2",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          Reintentar
        </button>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: "10px 24px",
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            color: "#8B99AE",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Recargar página
        </button>
      </div>
    );
  }
}
