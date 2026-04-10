import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App, { PortalApp } from './App.jsx'

// Detecta si se accede al portal de candidatos via ?apply o /#apply
const isPortal = window.location.search.includes("apply") || window.location.hash === "#apply";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isPortal ? <PortalApp /> : <App />}
  </StrictMode>,
)
