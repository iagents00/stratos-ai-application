import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, existsSync } from 'node:fs';
import postcss from 'postcss';
import { marketingLoginUrl } from '../src/landing/marketing-content.js';

test('the public site preserves commercial terms, contact and fixed login routes', async () => {
  const vite = await createServer({ appType: 'custom', logLevel: 'error', server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true, include: [] } });
  try {
    const { default: Landing } = await vite.ssrLoadModule('/src/landing/LandingMarketing.jsx');
    for (const [input, expected] of [
      [undefined, '/login'],
      ['https://app.stratoscapitalgroup.com/', 'https://app.stratoscapitalgroup.com/login'],
      ['https://app.getstratosai.com/?app=1&source=site', 'https://app.getstratosai.com/login?source=site'],
      ['/login?source=site', '/login?source=site'],
      ['/duke', '/duke'],
    ]) assert.equal(marketingLoginUrl(input), expected);
    const html = renderToStaticMarkup(createElement(Landing, { appUrl: 'https://app.getstratosai.com/' }));
    for (const text of ['Start', 'Growth', 'Scale', '$37', '$97', '$297', '$147/mes', '$797/mes', '$1,200', '$5,000', '3 usuarios incluidos', '10 usuarios incluidos', '25 usuarios incluidos']) assert.ok(html.includes(text), text);
    assert.equal((html.match(/<details>/g) || []).length, 8);
    assert.equal((html.match(/<h1>/g) || []).length, 1);
    assert.match(html, /Call Centers de IA/);
    const links = [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1].replaceAll('&amp;', '&'));
    const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(match => match[1]));
    for (const href of links) {
      if (href.startsWith('#') && href !== '#') assert.ok(ids.has(href.slice(1)), `Broken anchor ${href}`);
      if (href.startsWith('https://wa.me/')) assert.equal(new URL(href).pathname, '/17479779711');
    }
    for (const route of ['https://app.getstratosai.com/login', '/diagnostico', '/politica-de-privacidad', '/terminos-stratos-ai.html']) assert.ok(links.includes(route), route);
    for (const match of html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
      assert.ok(match[1].startsWith('/'), 'Screenshots and brand stay self-hosted');
      assert.ok(existsSync(new URL(`../public${match[1]}`, import.meta.url)), match[1]);
    }
    assert.match(html, /Capturas reales de Stratos AI con datos de demostración/);
  } finally { await vite.close(); }
});

test('marketing styles cannot alter authenticated app surfaces', () => {
  const css = postcss.parse(readFileSync(new URL('../src/landing/LandingMarketing.css', import.meta.url), 'utf8'));
  css.walkRules(rule => {
    if (rule.parent.type === 'atrule' && rule.parent.name.endsWith('keyframes')) return;
    for (const selector of rule.selectors) assert.match(selector, /^(?:\.stratos-marketing(?:\s|:|\[|$)|body\.stratos-public-site(?:\s|$))/, selector);
  });
  const config = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
  for (const path of ['marketing', 'fonts/marketing', 'branding/stratos-logo-web-20261016.webp']) assert.ok(config.includes(`'${path}'`), `Native build exclusion ${path}`);
});
