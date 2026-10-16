import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { createModuleRotation, moduleIndexForKey, MODULE_ROTATION_MS, SHOWCASE_MODULES } from '../src/landing/module-showcase.mjs';
import { rotatingWords } from '../src/landing/marketing-content.js';

function clock() {
  let now = 0, next = 0;
  const jobs = new Map();
  return {
    setTimeout(fn, delay) { const id = ++next; jobs.set(id, { at: now + delay, fn }); return id; },
    clearTimeout(id) { jobs.delete(id); },
    advance(ms) {
      const until = now + ms;
      while (true) {
        const nextJob = [...jobs.entries()].filter(([, job]) => job.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
        if (!nextJob) break;
        const [id, job] = nextJob; now = job.at; jobs.delete(id); job.fn();
      }
      now = until;
    },
    pending() { return jobs.size; },
  };
}

test('rotation wraps all six modules and seven headline options every 2800 ms, including reduced motion', () => {
  assert.equal(MODULE_ROTATION_MS, 2800);
  assert.equal(SHOWCASE_MODULES.length, 6);
  assert.equal(rotatingWords.length, 7);
  for (const count of [SHOWCASE_MODULES.length, rotatingWords.length]) {
    for (const reducedMotion of [false, true]) {
      const timers = clock(), states = [];
      const rotation = createModuleRotation({ count, reducedMotion, timers, onUpdate: state => states.push(state) });
      assert.equal(rotation.snapshot().paused, false);
      assert.equal(rotation.snapshot().reducedMotion, reducedMotion);
      timers.advance(2799); assert.equal(rotation.snapshot().index, 0);
      timers.advance(1); assert.equal(rotation.snapshot().index, 1);
      timers.advance(2800 * (count - 1)); assert.equal(rotation.snapshot().index, 0);
      assert.deepEqual(states.map(state => state.index), [...Array.from({ length: count }, (_, index) => index), 0]);
      rotation.destroy(); assert.equal(timers.pending(), 0);
      timers.advance(28000); assert.equal(states.length, count + 1);
    }
  }
});

test('keyboard focus, document visibility and viewport each pause independently and resume with a full interval', () => {
  for (const reason of ['focus', 'hidden', 'outside']) {
    const timers = clock();
    const rotation = createModuleRotation({ count: 6, timers, onUpdate() {} });
    timers.advance(1400); rotation.setPaused(reason, true);
    assert.equal(timers.pending(), 0, reason);
    timers.advance(28000); assert.equal(rotation.snapshot().index, 0, reason);
    rotation.setPaused(reason, false);
    timers.advance(2799); assert.equal(rotation.snapshot().index, 0, reason);
    timers.advance(1); assert.equal(rotation.snapshot().index, 1, reason);
    rotation.destroy();
  }
});

test('changing reduced motion updates its snapshot without pausing or restarting the current interval', () => {
  const timers = clock(), states = [];
  const rotation = createModuleRotation({ count: 6, reducedMotion: true, timers, onUpdate: state => states.push(state) });
  timers.advance(1400);
  rotation.setReducedMotion(false);
  assert.equal(rotation.snapshot().reducedMotion, false);
  assert.equal(rotation.snapshot().paused, false);
  assert.equal(timers.pending(), 1);
  timers.advance(1399); assert.equal(rotation.snapshot().index, 0);
  timers.advance(1); assert.equal(rotation.snapshot().index, 1);
  timers.advance(700);
  rotation.setReducedMotion(true);
  assert.equal(rotation.snapshot().reducedMotion, true);
  rotation.setReducedMotion(true);
  timers.advance(2099); assert.equal(rotation.snapshot().index, 1);
  timers.advance(1); assert.equal(rotation.snapshot().index, 2);
  const updates = states.length;
  rotation.destroy();
  rotation.setReducedMotion(false);
  timers.advance(28000);
  assert.equal(states.length, updates);
  assert.equal(timers.pending(), 0);
});

test('selecting a module restarts a full interval and continues automatically without a resume control', () => {
  const timers = clock();
  const rotation = createModuleRotation({ count: 6, timers, onUpdate() {} });
  timers.advance(2000); rotation.select(4);
  assert.equal(rotation.snapshot().paused, false);
  timers.advance(2799); assert.equal(rotation.snapshot().index, 4);
  timers.advance(1); assert.equal(rotation.snapshot().index, 5);
  timers.advance(1500); rotation.select(5);
  timers.advance(2799); assert.equal(rotation.snapshot().index, 5);
  timers.advance(1); assert.equal(rotation.snapshot().index, 0);
  assert.equal(timers.pending(), 1);
  rotation.destroy();
});

test('selection preserves all independent pauses and resumes after the last interaction or environment reason clears', () => {
  const timers = clock();
  const reasons = ['focus', 'hidden', 'outside'];
  const rotation = createModuleRotation({ count: 6, timers, pauseReasons: reasons, onUpdate() {} });
  rotation.select(4);
  for (const reason of reasons.slice(0, -1)) {
    rotation.setPaused(reason, false);
    assert.equal(rotation.snapshot().paused, true, reason);
    assert.equal(timers.pending(), 0, reason);
    timers.advance(28000); assert.equal(rotation.snapshot().index, 4, reason);
  }
  rotation.setPaused('outside', false);
  assert.equal(rotation.snapshot().paused, false);
  timers.advance(2799); assert.equal(rotation.snapshot().index, 4);
  timers.advance(1);
  assert.equal(rotation.snapshot().index, 5);
  rotation.destroy();
});

test('repeated observer notifications do not reset an active timer and keyboard navigation wraps correctly', () => {
  const timers = clock();
  const rotation = createModuleRotation({ count: 6, timers, onUpdate() {} });
  timers.advance(2000); rotation.setPaused('outside', false); timers.advance(800);
  assert.equal(rotation.snapshot().index, 1);
  assert.equal(moduleIndexForKey(5, 'ArrowRight', 6), 0);
  assert.equal(moduleIndexForKey(0, 'ArrowLeft', 6), 5);
  assert.equal(moduleIndexForKey(3, 'Home', 6), 0);
  assert.equal(moduleIndexForKey(3, 'End', 6), 5);
  assert.equal(moduleIndexForKey(3, 'Enter', 6), null);
  rotation.select(-1); assert.equal(rotation.snapshot().index, 1);
  rotation.destroy();
});

test('gallery styles stay inside both the public marketing page and module gallery', () => {
  const stylesheet = postcss.parse(readFileSync(new URL('../src/landing/ModuleShowcase.css', import.meta.url), 'utf8'));
  stylesheet.walkRules(rule => {
    if (rule.parent.type === 'atrule' && rule.parent.name.endsWith('keyframes')) return;
    for (const selector of rule.selectors) assert.match(selector, /^\.stratos-marketing \.stratos-modules(?:\s|:|\[|$)/, selector);
  });
});

test('module gallery renders six named tabs linked to real panels and complete locally framed demo screenshots', async () => {
  const vite = await createServer({ appType: 'custom', logLevel: 'error', server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true, include: [] } });
  try {
    const { default: ModuleShowcase } = await vite.ssrLoadModule('/src/landing/ModuleShowcase.jsx');
    const html = renderToStaticMarkup(createElement(ModuleShowcase, { appUrl: '/login?source=modules' }));
    assert.equal((html.match(/role="tab"/g) || []).length, 6);
    assert.equal((html.match(/<button\b/g) || []).length, 6);
    assert.doesNotMatch(html, /Pausar|Reanudar|recorrido automático/);
    assert.equal((html.match(/role="tabpanel"/g) || []).length, 6);
    assert.equal((html.match(/aria-selected="true"/g) || []).length, 1);
    assert.equal((html.match(/role="tabpanel"[^>]*hidden=""/g) || []).length, 5);
    const panelIds = [...html.matchAll(/id="([^"]+)" role="tabpanel"/g)].map(match => match[1]);
    for (const match of html.matchAll(/aria-controls="([^"]+)"/g)) assert.ok(panelIds.includes(match[1]));
    assert.deepEqual(SHOWCASE_MODULES.map(module => module.name), ['Copilot', 'CRM', 'Mi Espacio', 'Métricas', 'Comando', 'iAgents']);
    const images = [...html.matchAll(/<img\b[^>]*>/g)].map(match => match[0]);
    assert.equal(images.length, 6);
    for (const module of SHOWCASE_MODULES) {
      assert.equal(module.capabilities.length, 3);
      const path = module.id === 'copilot' ? '/marketing/modules/copilot-closeup-20261016/copilot.webp' : `/marketing/modules/framed-20261016/${module.id}.webp`;
      const image = images.find(tag => tag.includes(`src="${path}"`));
      assert.ok(image, module.id);
      assert.match(image, /width="1440" height="1020"/);
      assert.ok(image.includes(`alt="Captura real del módulo ${module.name} de Stratos AI con marco translúcido y datos de demostración"`));
    }
    assert.match(html, /Capturas reales de Stratos AI con datos de demostración/);
    assert.ok(html.includes('href="/login?source=modules"'));
    assert.doesNotMatch(html, /supabase|access_token|https:\/\//i);
  } finally { await vite.close(); }
});
