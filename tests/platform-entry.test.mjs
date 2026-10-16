import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const company = (id, name, managed = true) => ({
  id, name, slug: name.toLowerCase().replaceAll(' ', '-'), seats: 5, active: true,
  meta_config: managed ? { onboarding: { createdFrom: 'whatsapp_admin' } } : {},
});
const own = company('11111111-1111-4111-8111-111111111111', 'Horizonte QA');
const historical = company('22222222-2222-4222-8222-222222222222', 'Estudio QA', false);

test('global shell follows server authorization, preserves Stratos navigation, and exposes the own-CRM exit only when allowed', async () => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  const originalWindow = globalThis.window;
  try {
    const { AuthContext } = await vite.ssrLoadModule('/src/contexts/AuthContext.jsx');
    const { default: PlatformAdminConsole } = await vite.ssrLoadModule('/src/app/features/Admin/PlatformAdminConsole.jsx');
    const { P, LP } = await vite.ssrLoadModule('/src/design-system/tokens.js');
    const render = ({ root, email, role = 'admin', exit = true, width = 1280, theme = 'dark' }) => {
      globalThis.window = { location: new URL('http://localhost:5173/login'), innerWidth: width };
      const data = { organizations: root ? [own, historical] : [own], profiles: [], channels: [], runs: [], events: [], partners: [], provider: {}, access: { root, supportOnly: true, companyLimit: 5, companiesUsed: 1, scopeReady: true } };
      return renderToStaticMarkup(createElement(AuthContext.Provider, { value: {
        user: { id: '33333333-3333-4333-8333-333333333333', name: 'Operador QA', email, role, organizationId: own.id }, logout: () => {},
      } }, createElement(PlatformAdminConsole, { initialData: data, T: theme === 'light' ? LP : P, theme, onThemeChange: () => {}, onOpenOwnCRM: exit ? () => {} : undefined })));
    };

    const global = render({ root: true, email: 'ordinary@example.test', role: 'asesor' });
    assert.match(global, /class="platform-rail"/);
    assert.match(global, /class="platform-header"/);
    assert.match(global, /aria-label="Administración de Stratos"/);
    assert.match(global, /aria-label="CRM de empresas"/);
    assert.match(global, /aria-label="Usuarios"/);
    assert.match(global, /aria-label="Marketing"/);
    assert.match(global, /aria-label="Módulos y licencias"/);
    assert.match(global, /Administración global/);
    assert.match(global, /Horizonte QA/);
    assert.match(global, /Estudio QA/);
    assert.match(global, /aria-label="Abrir mi CRM"/);
    assert.match(global, /aria-label="Cerrar sesión"/);

    const scoped = render({ root: false, email: 'iagents.nsg@gmail.com', role: 'super_admin' });
    assert.match(scoped, /Mis empresas/);
    assert.match(scoped, /aria-label="CRM de empresas"/);
    assert.doesNotMatch(scoped, /aria-label="(?:Usuarios|Marketing|Partners y cupos|Actividad|Módulos y licencias)"/);
    assert.doesNotMatch(scoped, /Estudio QA/);

    const noOwnAccess = render({ root: true, email: 'operator@example.test', exit: false });
    assert.doesNotMatch(noOwnAccess, /aria-label="Abrir mi CRM"|class="platform-own-crm"/);
    assert.match(noOwnAccess, /aria-label="CRM de empresas"/);
    const mobile = render({ root: true, email: 'operator@example.test', width: 390, theme: 'light' });
    assert.match(mobile, /aria-label="Abrir menú" aria-expanded="false" aria-controls="platform-navigation"/);
    assert.match(mobile, /aria-label="Abrir mi CRM"/);
    assert.match(mobile, /data-theme="light"/);
  } finally {
    if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
    await vite.close();
  }
});
