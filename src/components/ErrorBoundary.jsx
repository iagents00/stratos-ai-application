/**
 * components/ErrorBoundary.jsx
 * React Error Boundary — captura errores de render y los muestra limpiamente
 * en vez de dejar la pantalla en blanco.
 */
import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
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
          onClick={() => { this.setState({ hasError: false, error: null }); }}
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
