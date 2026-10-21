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
      if (href.startsWith('https://wa.me/')) assert.equal(new URL(href).pathname, '/529842803001');
    }
    for (const route of ['https://app.getstratosai.com/login', '/diagnostico', '/politica-de-privacidad', '/terminos-stratos-ai.html']) assert.ok(links.includes(route), route);
    for (const match of html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
      assert.ok(match[1].startsWith('/'), 'Screenshots and brand stay self-hosted');
      assert.ok(existsSync(new URL(`../public${match[1]}`, import.meta.url)), match[1]);
    }
    // Signals must stay on actual lattice edges, including across the quiet center.
    const networks = [...html.matchAll(/<svg class="smk-hero-flow-network[^"]*"[\s\S]*?<\/svg>/g)].map(match => match[0]);
    assert.equal(networks.length, 2);
    for (const network of networks) {
      assert.doesNotMatch(network, /<circle|smk-hero-flow-glint/);
      const edgeNumbers = network.match(/class="smk-hero-flow-connections" d="([^"]+)"/)[1].match(/-?\d+/g).map(Number);
      const edges = new Set();
      for (let i = 0; i < edgeNumbers.length; i += 4) {
        const from = edgeNumbers.slice(i, i + 2).join(','), to = edgeNumbers.slice(i + 2, i + 4).join(',');
        edges.add(`${from}|${to}`); edges.add(`${to}|${from}`);
      }
      const routes = [...network.matchAll(/data-flow-route="([^"]+)"/g)];
      assert.equal(routes.length, 8);
      const width = Number(network.match(/viewBox="0 0 (\d+)/)[1]);
      for (const [, path] of routes) {
        const points = path.match(/-?\d+/g).map(Number);
        assert.ok(points[0] > width * .3 && points[0] < width * .65, 'Routes originate in the central area');
        assert.ok(Math.abs(points.at(-2) - width / 2) > Math.abs(points[0] - width / 2), 'Routes travel outward');
        const dx = points[2] - points[0], dy = points[3] - points[1];
        for (let i = 2; i < points.length; i += 2) {
          assert.ok((points[i] - points[i - 2]) * dx > 0, 'Route progresses without doubling back');
          assert.equal((points[i] - points[0]) * dy, (points[i + 1] - points[1]) * dx, 'Meteor follows a straight line, never zigzags');
          assert.ok(edges.has(`${points.slice(i - 2, i).join(',')}|${points.slice(i, i + 2).join(',')}`), 'Signal follows a real edge');
        }
      }
    }
    assert.match(html, /Capturas reales de Stratos AI con datos de demostración/);
    assert.equal((html.match(/src="\/marketing\/modules\/copilot-closeup-20261016\/copilot.webp"/g) || []).length, 2, 'Gallery and workflow share the legible Copilot capture');
  } finally { await vite.close(); }
});

test('marketing styles cannot alter authenticated app surfaces', () => {
  for (const file of ['LandingMarketing.css', 'FeatureMotion.css', 'HeroFlowBackdrop.css']) {
    const css = postcss.parse(readFileSync(new URL(`../src/landing/${file}`, import.meta.url), 'utf8'));
    css.walkRules(rule => {
      if (rule.parent.type === 'atrule' && rule.parent.name.endsWith('keyframes')) return;
      for (const selector of rule.selectors) assert.match(selector, /^(?:\.stratos-marketing(?:\s|:|\[|$)|body\.stratos-public-site(?:\s|$))/, selector);
    });
  }
  const config = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
  for (const path of ['marketing', 'fonts/marketing', 'branding/stratos-logo-web-20261016.webp']) assert.ok(config.includes(`'${path}'`), `Native build exclusion ${path}`);
});
