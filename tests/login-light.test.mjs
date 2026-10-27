import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('login preserves common and tenant branding, recovery controls and native registration restrictions', async () => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  const original = globalThis.window;
  try {
    const { default: LoginScreen } = await vite.ssrLoadModule('/src/landing/LoginScreen.jsx');
    const { ClientContext } = await vite.ssrLoadModule('/src/contexts/ClientContext.jsx');
    const render = (path, native = false) => {
      globalThis.window = { location: new URL(`https://app.getstratosai.com${path}`), Capacitor: { isNativePlatform: () => native } };
      return renderToStaticMarkup(createElement(ClientContext.Provider, { value: { clientId: 'test-company', config: { name: 'Empresa QA', brand: { logoText: 'Empresa QA' }, login: { heroTop: 'Atención especializada', heroBot: 'para tu equipo', sub: ['Acceso de empresa'], stats: [['Equipo', 'Tu organización']] } } } }, createElement(LoginScreen, { onLogin: () => {} })));
    };
    const common = render('/login');
    assert.match(common, /Stratos/);
    assert.doesNotMatch(common, /Empresa QA|Atención especializada/);
    assert.match(common, /stratos-logo-web-20261016.webp/);
    assert.match(common, /autoComplete="username"/i);
    assert.match(common, /autoComplete="current-password"/i);
    assert.match(common, /Mostrar contraseña/);
    assert.match(common, /¿Olvidaste tu contraseña\?/);
    const branded = render('/test-company');
    assert.match(branded, /Empresa QA/);
    assert.match(branded, /Atención especializada/);
    assert.doesNotMatch(branded, /Entrar como Demo/);
    const register = render('/login?register=true');
    assert.match(register, /Mínimo 8 caracteres/);
    assert.match(register, /Crear cuenta/);
    const native = render('/login?register=true', true);
    assert.match(native, /Bienvenido de vuelta/);
    assert.doesNotMatch(native, /Crear cuenta|Solicitar acceso/);
  } finally { globalThis.window = original; await vite.close(); }
});

test('boot is white with absent, dark or inaccessible theme storage, without overwriting preference', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]).find(source => source.includes('s.id = "stratos-splash"'));
  for (const preference of [null, 'dark', 'light', 'blocked']) {
    const elements = new Map();
    const attributes = {};
    const document = {
      documentElement: { setAttribute: (key, value) => { attributes[key] = value; } },
      createElement: () => ({ style: {}, setAttribute(key, value) { this[key] = value; } }),
      head: { appendChild: () => {} },
      body: { appendChild: node => elements.set(node.id, node) },
      getElementById: id => elements.get(id),
      addEventListener: () => {},
    };
    vm.runInNewContext(script, { document, window: {}, localStorage: { getItem() { if (preference === 'blocked') throw Error('blocked'); return preference; }, setItem() { throw Error('must not overwrite theme'); } }, setTimeout: () => 1, setInterval: () => 1, clearInterval: () => {} });
    assert.match(elements.get('stratos-splash').style, /background:#FFFFFF/);
    assert.equal(attributes['data-theme'], preference === 'dark' ? 'dark' : 'light');
  }
});
