#!/usr/bin/env node
/**
 * tools/check_plan_semanal.mjs — chequeo de la lógica del Plan Semanal.
 *
 * Corre sin navegador contra `src/app/views/plan-semanal.js`. Cubre lo que se
 * rompe en silencio: en qué lunes cae una fecha (el DOMINGO es el caso clásico),
 * el ISO local (toISOString daría el día anterior al oeste de UTC), la forma de
 * la grilla y que el JSON guardado se lea sin reventar aunque venga corrupto.
 *
 *   node tools/check_plan_semanal.mjs
 */
import {
  DIAS, FRANJAS, lunesDe, isoDe, fechaCorta, planVacio, parsePlan,
  franjasLlenas, tituloFilaDe, slotKey,
} from '../src/app/views/plan-semanal.js'

let ok = 0, fail = 0
const eq = (nombre, a, b) => {
  const A = JSON.stringify(a), B = JSON.stringify(b)
  if (A === B) { ok++ } else { fail++; console.log(`  ✗ ${nombre}\n      esperaba ${B}\n      obtuvo   ${A}`) }
}

/* ── La grilla, igual que la hoja de Drive ── */
eq('7 días', DIAS.length, 7)
eq('empieza en lunes', DIAS[0].k, 'lun')
eq('termina en domingo', DIAS[6].k, 'dom')
eq('19 franjas', FRANJAS.length, 19)
eq('primera franja 09:00', FRANJAS[0], '09:00')
eq('última franja 18:00', FRANJAS[FRANJAS.length - 1], '18:00')
eq('media hora entre franjas', [FRANJAS[1], FRANJAS[2]], ['09:30', '10:00'])
eq('sin franjas repetidas', new Set(FRANJAS).size, 19)

/* ── El lunes de la semana ──────────────────────────────────────────────────
   Julio 2026: el 27 es LUNES, el 2 de agosto es DOMINGO de esa misma semana. */
const d = (y, m, dd) => new Date(y, m - 1, dd)
eq('lunes → él mismo',      isoDe(lunesDe(d(2026, 7, 27))), '2026-07-27')
eq('miércoles → su lunes',  isoDe(lunesDe(d(2026, 7, 29))), '2026-07-27')
eq('viernes → su lunes',    isoDe(lunesDe(d(2026, 7, 31))), '2026-07-27')
eq('sábado → su lunes',     isoDe(lunesDe(d(2026, 8,  1))), '2026-07-27')
eq('DOMINGO → su lunes (no el siguiente)', isoDe(lunesDe(d(2026, 8, 2))), '2026-07-27')
eq('lunes siguiente',       isoDe(lunesDe(d(2026, 8, 3))), '2026-08-03')
// Cruce de mes y de año
eq('cruce de mes',  isoDe(lunesDe(d(2026, 9, 2))), '2026-08-31')
eq('cruce de año',  isoDe(lunesDe(d(2027, 1, 1))), '2026-12-28')
// No muta la fecha que recibe
const orig = d(2026, 7, 30); lunesDe(orig)
eq('no muta el argumento', isoDe(orig), '2026-07-30')
// Con hora cargada sigue dando el mismo lunes (medianoche local)
eq('ignora la hora', isoDe(lunesDe(new Date(2026, 6, 29, 23, 45))), '2026-07-27')

/* ── ISO local, no UTC ── */
eq('isoDe usa hora local', isoDe(new Date(2026, 0, 1, 0, 30)), '2026-01-01')
eq('fechaCorta', fechaCorta(d(2026, 7, 27)), '27 jul')

/* ── La llave de la fila en mkt_tasks ── */
eq('título de fila', tituloFilaDe(d(2026, 7, 27)), 'Plan semanal 2026-07-27')
eq('llave de franja', slotKey('mie', '14:30'), 'mie|14:30')

/* ── parsePlan aguanta cualquier cosa ── */
eq('vacío',        parsePlan(null), planVacio())
eq('string roto',  parsePlan('{no es json'), planVacio())
eq('array',        parsePlan('[1,2,3]'), planVacio())
eq('slots no-objeto', parsePlan('{"slots":"x"}'), planVacio())
eq('slots array',  parsePlan('{"slots":[1,2]}'), planVacio())
eq('descarta franjas vacías',
   parsePlan('{"slots":{"lun|09:00":"junta","mar|10:00":"   ","mie|11:00":null}}').slots,
   { 'lun|09:00': 'junta' })
eq('notas no-string se ignoran', parsePlan('{"notas":42}').notas, '')
eq('prioridades sin texto se descartan',
   parsePlan('{"prioridades":[{"texto":"cierre"},{"texto":"  "},{"nada":1}]}').prioridades,
   [{ texto: 'cierre', hecha: false }])
eq('hecha solo si es true',
   parsePlan('{"prioridades":[{"texto":"a","hecha":"si"},{"texto":"b","hecha":true}]}').prioridades,
   [{ texto: 'a', hecha: false }, { texto: 'b', hecha: true }])

/* ── Ida y vuelta: lo que se guarda es lo que se lee ── */
const plan = {
  slots: { 'lun|09:00': 'Junta de área', 'vie|17:30': 'Cierre y actualizar plan' },
  notas: 'Entregar el corte el viernes',
  prioridades: [{ texto: 'Corte de caja', hecha: false }],
}
eq('round-trip', parsePlan(JSON.stringify(plan)), plan)
eq('conteo de franjas', franjasLlenas(plan), 2)
eq('conteo con plan vacío', franjasLlenas(planVacio()), 0)
eq('conteo tolera basura', franjasLlenas(null), 0)

console.log(`\n${ok} ok · ${fail} fallando`)
process.exit(fail ? 1 : 0)
