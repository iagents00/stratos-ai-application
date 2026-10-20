import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.slice(html.indexOf('<!-- ─── [guard:APP-NO-ZOOM]')).match(/<script>([\s\S]*?)<\/script>/)[1];
function boot(url, { installed = true, native = false } = {}) {
  const attributes = {};
  const listeners = [];
  const navigator = { standalone: installed, userAgent: 'test' };
  const window = {
    location: new URL(url), navigator,
    Capacitor: { isNativePlatform: () => native },
    addEventListener: name => listeners.push(name),
  };
  const document = {
    querySelector: () => null,
    documentElement: { setAttribute: (key, value) => { attributes[key] = value; } },
    createElement: () => ({}), head: { appendChild() {} }, addEventListener() {},
  };
  runInNewContext(script, { window, navigator, document, URLSearchParams });
  return { fixed: attributes['data-standalone'] === '1', pinned: listeners.includes('scroll') };
}
test('installed marketing homepage retains document scrolling and zoom', () => {
  for (const url of ['https://www.getstratosai.com/', 'http://localhost:5173/', 'http://127.0.0.1:5173/?source=campaign']) {
    assert.deepEqual(boot(url), { fixed: false, pinned: false }, url);
  }
});
test('installed CRM and native app retain viewport protection', () => {
  for (const url of ['https://getstratosai.com/', 'https://app.getstratosai.com/', 'https://www.getstratosai.com/login', 'http://localhost:5173/?app', 'http://localhost:5173/?client=grupo28', 'http://localhost:5173/grupo28']) {
    assert.deepEqual(boot(url), { fixed: true, pinned: true }, url);
  }
  assert.deepEqual(boot('http://localhost/', { native: true }), { fixed: true, pinned: true });
  assert.deepEqual(boot('https://getstratosai.com/', { installed: false }), { fixed: false, pinned: false });
});
