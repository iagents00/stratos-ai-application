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
    <aside aria-label="Modo invitado" title="Datos ficticios. Los cambios duran mientras esta demo está abierta. No introduzcas información personal." style={{ minHeight: 52, flexShrink: 0, boxSizing: 'border-box', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 12px', padding: '8px 12px', background: P.bg, color: P.txt, fontFamily: font, fontSize: 12, lineHeight: 1.4, borderBottom: `1px solid ${P.border}` }}>
      <span style={{ flex: '1 1 140px', minWidth: 0 }}>Invitado · Datos ficticios</span>
      <button onClick={reset} style={{ color: P.accent, background: 'transparent', border: 0, minHeight: 44, padding: '4px 8px', flexShrink: 0, whiteSpace: 'nowrap', font: 'inherit' }}>Reiniciar demo</button>
      <a href="/index.html?app" style={{ color: P.accent, minHeight: 44, padding: '4px 8px', boxSizing: 'border-box', flexShrink: 0, display: 'flex', alignItems: 'center' }}>Salir</a>
    </aside>
    <div className="guest-real-workspace"><ErrorBoundary><App key={generation} /></ErrorBoundary></div>
  </>;
}
export function mountGuest() {
  createRoot(document.getElementById('guest-root')).render(<StrictMode><Workspace /></StrictMode>);
}
