import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FEATURES, FEATURE_CATEGORIES, filterFeatures } from '../src/landing/features-content.mjs';

test('feature discovery handles accents, multiple words, category combinations and empty results', () => {
  assert.deepEqual(filterFeatures('  CALIFICACION  '), filterFeatures('calificación'));
  assert.ok(filterFeatures('voz').length > 0);
  assert.equal(filterFeatures('', 'voz').length, 5);
  assert.ok(filterFeatures('llamadas', 'voz').every(item => item.category === 'voz'));
  assert.equal(filterFeatures('qwerty-no-existe').length, 0);
  assert.equal(filterFeatures('voz', 'clientes').length, 0);
  assert.ok(filterFeatures('perfil contexto').length > 0);
  assert.equal(new Set(FEATURES.map(item => item.id)).size, FEATURES.length);
  for (const feature of FEATURES) {
    assert.ok(FEATURE_CATEGORIES.some(category => category.id === feature.category));
    for (const key of ['title', 'before', 'after', 'benefit', 'condition']) assert.ok(feature[key]?.trim());
  }
});

test('public feature page provides complete content, working destinations and local assets', async () => {
  const vite = await createServer({ appType: 'custom', logLevel: 'error', server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true, include: [] } });
  try {
    const { default: Page } = await vite.ssrLoadModule('/src/landing/Functionalities.jsx');
    const html = renderToStaticMarkup(createElement(Page));
    assert.equal((html.match(/<h1>/g) || []).length, 1);
    assert.equal((html.match(/<details>/g) || []).length, FEATURES.length);
    assert.match(html, /Ejemplo ilustrativo con datos ficticios/);
    assert.match(html, /https:\/\/cal.com\/ivanrr.oficial\/nsg/);
    const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(match => match[1]));
    for (const [, href] of html.matchAll(/href="(#[^"]+)"/g)) assert.ok(ids.has(href.slice(1)), href);
    for (const [, src] of html.matchAll(/<img[^>]+src="([^"]+)"/g)) assert.ok(existsSync(new URL(`../public${src}`, import.meta.url)), src);
    assert.ok(existsSync(new URL('../public/marketing/funcionalidades/callcenter-puntos.png', import.meta.url)));
    const main = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
    assert.match(main, /isFunctionalities = matchPath\(\["\/funcionalidades"\]\)/);
    assert.match(main, /!isFunctionalities/);
    assert.match(main, /isFunctionalities\s*\? <Functionalities/);
  } finally { await vite.close(); }
});
