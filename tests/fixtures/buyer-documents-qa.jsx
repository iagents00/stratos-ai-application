// Synthetic local QA only. Start Vite with VITE_SUPABASE_URL=http://127.0.0.1:4179
// and intercept that origin in the browser before navigating here.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthContext } from '../../src/contexts/AuthContext';
import { ClientProvider } from '../../src/contexts/ClientContext';
import { NotesModal, StageBadge } from '../../src/app/views/CRM/components';
import { LP, P } from '../../src/design-system/tokens';
import { DEFAULT_CLIENT_CONFIG } from '../../src/clients/_shared/defaults';
if (!import.meta.env.DEV || import.meta.env.VITE_SUPABASE_URL !== 'http://127.0.0.1:4179') throw new Error('Use the isolated QA backend.');
const id = '10000000-0000-4000-8000-000000000001';
const org = '00000000-0000-0000-0000-000000000001';
const user = { id: '20000000-0000-4000-8000-000000000001', organizationId: org, role: new URLSearchParams(location.search).has('advisor') ? 'asesor' : 'admin', name: 'Asesor QA' };
const initial = { id, n: 'Cliente de prueba', phone: '+52 555 000 0001', email: 'cliente@example.com', asesor: user.name, notas: 'Expediente de demostración. Datos ficticios.', st: 'Apartó', sc: 85, budget: '$300K USD', seguimientos: 1, actionHistory: [], id_document: 'PAS-TEST-001', id_document_path: `id-doc/${org}/${id}/legacy.pdf` };
const config = { ...DEFAULT_CLIENT_CONFIG, id: 'duke', features: { ...DEFAULT_CLIENT_CONFIG.features, whatsappChat: false } };
function Fixture() {
  const [lead, setLead] = useState(() => JSON.parse(localStorage.getItem('buyer-qa-lead') || 'null') || initial);
  const [open, setOpen] = useState(true);
  const T = new URLSearchParams(location.search).has('dark') ? P : LP;
  useEffect(() => { localStorage.setItem('buyer-qa-lead', JSON.stringify(lead)); }, [lead]);
  return <AuthContext.Provider value={{ user, loading: false }}><ClientProvider config={config}>
    <main style={{ padding: 30, minHeight: '100vh', background: T.bg, color: T.txt }}><h1>Expediente · QA</h1><button onClick={() => setOpen(true)}>Abrir expediente</button><StageBadge st={lead.st} onChange={st => setLead(previous => ({ ...previous, st }))} T={T} /></main>
    <NotesModal lead={open ? lead : null} onClose={() => setOpen(false)} onSave={notas => setLead(previous => ({ ...previous, notas }))} onUpdate={patch => setLead(previous => ({ ...previous, ...patch }))} T={T} discoverySimplified asesoresMaster={[]} />
  </ClientProvider></AuthContext.Provider>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
