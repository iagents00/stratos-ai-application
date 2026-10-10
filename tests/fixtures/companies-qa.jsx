// Development fixture only. API calls are intercepted in browser tests; no production mutations.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import PlatformAdminConsole from '../../src/app/features/Admin/PlatformAdminConsole';
import { AuthContext } from '../../src/contexts/AuthContext';
import { ClientProvider } from '../../src/contexts/ClientContext';
import { getClientConfig } from '../../src/clients';
import { P, LP } from '../../src/design-system/tokens';
const company = (id, name, managed = true) => ({ id, name, slug: name.toLowerCase(), seats: 5, active: true, meta_config: managed ? { onboarding: { createdFrom: 'whatsapp_admin' } } : {} });
const initialData = {
  organizations: [company('qa-a', 'Horizonte'), company('qa-b', 'Estudio Norte'), company('qa-duke', 'Duke', false), company('qa-nsg', 'NSG', false)],
  profiles: [{ id: 'qa-admin', name: 'Administradora Horizonte', organization_id: 'qa-a', role: 'admin', active: true }],
  channels: [], runs: [], events: [], partners: [], access: { root: true, supportOnly: true, scopeReady: true }, provider: {},
};
function QA() {
  const [theme, setTheme] = useState(new URLSearchParams(location.search).get('theme') || 'dark');
  return <AuthContext.Provider value={{ user: { id: 'qa-operator', name: 'Operador de prueba', isDemo: true }, logout: () => {} }}><ClientProvider config={getClientConfig('tenant')}><PlatformAdminConsole initialData={initialData} T={theme === 'light' ? LP : P} theme={theme} onThemeChange={setTheme} /></ClientProvider></AuthContext.Provider>;
}
createRoot(document.getElementById('root')).render(<QA />);
