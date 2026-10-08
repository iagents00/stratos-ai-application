import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../app/App.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
import { P, font } from '../design-system/tokens.js';
import '../index.css';
import '../mobile-perf.css';

function Workspace() {
  const [generation, setGeneration] = useState(0);
  const reset = async () => {
    const { resetGuestData } = await import('./backend.js');
    resetGuestData();
    localStorage.clear(); sessionStorage.clear(); // Memory stores installed before App imports.
    setGeneration(value => value + 1);
  };
  return <>
    <aside aria-label="Modo invitado" title="Datos ficticios. Los cambios duran mientras esta demo está abierta. No introduzcas información personal." style={{ height: 52, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: P.bg, color: P.txt, fontFamily: font, fontSize: 12, borderBottom: `1px solid ${P.border}` }}>
      <span style={{ flex: 1 }}>Invitado · Datos ficticios</span>
      <button onClick={reset} style={{ color: P.accent, background: 'transparent', border: 0, minHeight: 36, font: 'inherit' }}>Reiniciar demo</button>
      <a href="/index.html?app" style={{ color: P.accent, minHeight: 36, display: 'flex', alignItems: 'center' }}>Salir</a>
    </aside>
    <div className="guest-real-workspace"><ErrorBoundary><App key={generation} /></ErrorBoundary></div>
  </>;
}
export function mountGuest() {
  createRoot(document.getElementById('guest-root')).render(<StrictMode><Workspace /></StrictMode>);
}
