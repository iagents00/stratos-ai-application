/** main.jsx — Entrada independiente del invitado, sin proveedores de la app. */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import GuestWorkspace from './GuestWorkspace.jsx';

// No application providers, storage, native plugins, API clients or tenant data.
createRoot(document.getElementById('guest-root')).render(
  <StrictMode><GuestWorkspace /></StrictMode>,
);
