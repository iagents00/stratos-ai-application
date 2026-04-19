import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import LandingMarketing from './LandingMarketing.jsx'

const hostname = window.location.hostname;
const isApp = hostname.startsWith('app.') || new URLSearchParams(window.location.search).has('app');

const appUrl = import.meta.env.VITE_APP_URL || 'http://localhost:5173/?app';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isApp ? <App /> : <LandingMarketing appUrl={appUrl} />}
  </StrictMode>
);
