import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateCommandMetrics, buildMetricBuckets, buildMetricSeries, advisorReportRows, percentage, INDICATOR_DEFINITIONS } from '../src/app/views/CRM/command-metrics.js';
import { resolveDateRange, parseDateInput, timestampInRange, dateInputValue } from '../src/app/views/CRM/date-range.js';
import { zoomEventsOf, funnelEntryOf, zoomMovements } from '../src/app/views/CRM/zoom-metrics.js';
import { productivityRows } from '../src/app/views/CRM/productivity-metrics.js';
import { readAllRows } from '../src/lib/read-all-rows.js';
import { createCommandReport } from '../src/app/views/CRM/command-report.js';
import { buildExecutivePdf } from '../src/app/views/ComandoDirectivo.pdf.js';
import { jsPDF } from 'jspdf';

const hit = (stage, at, by) => ({ type: 'etapa', action: 'Etapa: Contáctame Ya → ' + stage, created_at: at, by });
const range = resolveDateRange('custom', '2026-09-01', '2026-09-30');
const leads = [
  { id: 'old', created_at: '2024-01-04', asesor: 'Dueño nuevo', st: 'Seguimiento', seguimientos: '2', actionHistory: [hit('Seguimiento', '2026-09-20', 'Dueño nuevo'), hit('Zoom Concretado', '2026-09-03', 'Presentador'), hit('Zoom Agendado', '2026-08-31', 'Liner')] },
  { id: 'no-owner', created_at: '2026-09-01', asesor: '  ', st: 'Zoom Concretado', seguimientos: '3', actionHistory: [hit('Zoom Concretado', '2026-09-05', '')] },
  { id: 'inactive', created_at: '2026-09-30', asesor: ' Asesor Prueba ', st: 'Segundo Intento', seguimientos: 'bad', actionHistory: [hit('Zoom Agendado', '2026-09-04', ' Ken Lugo ')] },
  { id: 'undated', created_at: null, asesor: 'Ana', st: 'Seguimiento', seguimientos: -7 },
  { id: 'next-month', created_at: '2026-10-01', asesor: 'Ana', st: 'Contáctame Ya', seguimientos: 1 },
  { id: 'deleted', created_at: '2026-09-01', asesor: 'Ana', st: 'Cierre', deleted_at: '2026-09-02', seguimientos: 100 },
];

test('table, totals and export credit the original event author, including unassigned and inactive', () => {
  const result = aggregateCommandMetrics(leads, range);
  assert.equal(result.cohort.length, 2);
  assert.equal(result.totals.assigned, 1);
  assert.equal(result.totals.zoomDone, 2);
  assert.equal(result.totals.zoomScheduled, 2);
  assert.equal(result.totals.followUps, 3);
  assert.equal(result.rows.find(r => r.asesor === 'Presentador').count, 0);
  assert.equal(result.rows.find(r => r.asesor === 'Presentador').metrics.zoomDone, 1);
  assert.equal(result.rows.find(r => r.asesor === 'Sin asignar').metrics.zoomDone, 1);
  assert.equal(result.rows.find(r => r.asesor === 'Cuentas inactivas').metrics.zoomScheduled, 1);
  const exported = advisorReportRows(result.rows);
  for (const [index, indicator] of INDICATOR_DEFINITIONS.entries()) {
    assert.equal(exported.reduce((sum, row) => sum + row[index + 2], 0), result.totals[indicator.key]);
  }
});

test('every evolution column sums to the range total for day/week/month/history', () => {
  const active = leads.filter(l => !l.deleted_at);
  const dates = active.flatMap(l => [l.created_at, ...zoomMovements([l]).map(m => m.at)]);
  for (const filter of [range, resolveDateRange('all')]) {
    const expected = aggregateCommandMetrics(leads, filter).totals;
    for (const granularity of ['day', 'week', 'month']) {
      const buckets = buildMetricBuckets(granularity, filter, dates, new Date(2026, 8, 17));
      const series = buildMetricSeries(leads, buckets);
      for (const indicator of INDICATOR_DEFINITIONS) assert.equal(series.reduce((sum, row) => sum + row[indicator.key], 0), expected[indicator.key], granularity + ':' + indicator.key);
    }
  }
});

test('history includes old months and unknown dates; current-day marker is truthful', () => {
  const all = buildMetricBuckets('month', null, ['2020-01-01', '2026-09-30', null], new Date(2026, 8, 17));
  assert.equal(all[0].csvLabel, '2020-01');
  assert.equal(all.length, 82);
  assert.equal(all.at(-1).undated, true);
  const old = buildMetricBuckets('day', resolveDateRange('custom', '2024-01-01', '2024-01-05'), [], new Date(2026, 8, 17));
  assert.ok(old.every(b => !b.isCurrent));
  const month = buildMetricBuckets('day', range, [], new Date(2026, 8, 17));
  assert.equal(month.find(b => b.isCurrent).key, '2026-09-17');
});

test('date-only input uses local calendar dates and ranges include the last day', () => {
  assert.equal(parseDateInput('2026-02-31'), null);
  assert.equal(parseDateInput('2026-13-01'), null);
  assert.equal(parseDateInput('invalid'), null);
  assert.equal(dateInputValue(parseDateInput('2024-02-29')), '2024-02-29');
  assert.equal(timestampInRange('2026-09-01', range), true);
  assert.equal(timestampInRange('2026-09-30', range), true);
  assert.equal(timestampInRange('2026-10-01', range), false);
  assert.equal(timestampInRange(null, range), false);
  assert.equal(timestampInRange(null, resolveDateRange('all')), true);
  const reversed = resolveDateRange('custom', '2026-09-30', '2026-09-01');
  assert.deepEqual(reversed, range);
});

test('reschedules and later-stage actions cannot rewrite first milestone date or author', () => {
  const lead = { ...leads[0], st: 'Zoom Concretado', next_action_at: '2026-09-29', selected_time: 'invalid' };
  const events = zoomEventsOf(lead);
  assert.equal(events.scheduled.at, '2026-08-31');
  assert.equal(events.done.at, '2026-09-03');
  assert.equal(events.done.by, 'Presentador');
  assert.equal(zoomEventsOf({ st: 'Zoom Agendado', next_action_at: 'invalid' }).scheduled.at, null);
  assert.equal(zoomEventsOf({ st: 'Contáctame Ya', next_action_at: '2026-09-10' }).scheduled, null);
  assert.equal(zoomEventsOf({ st: 'Zoom Concretado', next_action_at: '2026-09-10' }).done.at, null);
  assert.equal(funnelEntryOf({ st: 'Seguimiento' }).inferred, true);
});

test('empty data, zero denominators and numeric-string counters are honest', () => {
  const empty = aggregateCommandMetrics([], range);
  assert.ok(Object.values(empty.totals).every(v => v === 0));
  assert.equal(percentage(0, 0), null);
  assert.equal(percentage(0, 10), 0);
  assert.equal(percentage(3, 4), 75);
  const metrics = aggregateCommandMetrics([{ asesor: '__proto__', seguimientos: '3' }, { seguimientos: Infinity }, { seguimientos: -1 }, { seguimientos: '2' }], null);
  assert.equal(metrics.totals.followUps, 5);
});

test('productivity applies due date, groups inactive/unassigned, and uses exclusive states', () => {
  const actions = [
    { asesor_name: 'Ana', due_at: '2026-09-01', created_at: '2024-01-01', done: true },
    { asesor_name: 'Ana', due_at: '2026-09-30', status: 'in_progress' },
    { asesor_name: 'Ana', due_at: '2026-10-01', done: true },
    { asesor_name: '', created_at: '2026-09-10', status: 'not_done' },
    { asesor_name: 'Asesor Prueba', due_at: null },
  ];
  const rows = productivityRows(actions, range);
  const ana = rows.find(r => r.asesor === 'Ana');
  assert.equal(ana.total, 2);
  assert.equal(percentage(ana.done, ana.total), 50);
  assert.equal(ana.pend, 1);
  assert.equal(rows.find(r => r.asesor === 'Sin asignar').notDone, 1);
  assert.equal(productivityRows(actions, null).find(r => r.asesor === 'Cuentas inactivas').total, 1);
});

test('pagination reads >1000 records even when the server caps responses below the requested size', async () => {
  const source = Array.from({ length: 1243 }, (_, id) => ({ id }));
  const result = await readAllRows(() => ({ range: async (from, to) => ({ data: source.slice(from, Math.min(to + 1, from + 200)), error: null }) }));
  assert.equal(result.error, null);
  assert.deepEqual(result.data, source);
});

test('a failed page or thrown network failure never returns partial totals as success', async () => {
  const partial = await readAllRows(() => ({ range: async from => from ? { data: null, error: { message: 'Offline' } } : { data: [{ id: 1 }], error: null } }));
  assert.equal(partial.data, null);
  assert.equal(partial.error.message, 'Offline');
  const thrown = await readAllRows(() => ({ range: async () => { throw new Error('Network error'); } }));
  assert.equal(thrown.data, null);
  assert.equal(thrown.error.message, 'Network error');
});

test('the actual PDF model shares table totals and computes conversion on the same lead cohort', () => {
  const buckets = buildMetricBuckets('day', range);
  const model = createCommandReport({ leads, range, buckets, series: buildMetricSeries(leads, buckets), clientName: 'Prueba', granularityLabel: 'Día', labels: {}, colors: {} });
  assert.deepEqual(model.asesores.rows, advisorReportRows(aggregateCommandMetrics(leads, range).rows));
  assert.deepEqual(model.evolution.totals.slice(1), INDICATOR_DEFINITIONS.map(i => aggregateCommandMetrics(leads, range).totals[i.key]));
  // One of the two new leads has a Zoom; the older presenter's event is excluded from this rate.
  assert.equal(model.rangeCards[2].value, '50%');
  const doc = buildExecutivePdf(jsPDF, model);
  assert.ok(doc.getNumberOfPages() > 0);
  assert.match(Buffer.from(doc.output('arraybuffer')).subarray(0, 8).toString(), /^%PDF-/);
  const empty = createCommandReport({ leads: [], range, buckets: [], series: [], clientName: 'Prueba', granularityLabel: 'Día', labels: {}, colors: {} });
  assert.equal(empty.rangeCards[1].value, '—');
  assert.equal(empty.rangeCards[2].value, '—');
});
