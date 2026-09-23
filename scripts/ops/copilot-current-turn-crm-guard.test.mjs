import test from 'node:test';
import assert from 'node:assert/strict';
import {
  marker,
  patchCurrentTurnCrmInterpreter,
} from './copilot-current-turn-crm-guard.mjs';

const fixture = `
let ruta = ['redistribuir','actividades','completar','correccion','recordatorio','equipo','crm'].includes(p.ruta) ? p.ruta : 'crm';
const esConfirmacion = false;
const esAgendaPersonal = false;
const esAltaMasivaConDatos = _looksLikeBulkLeadInput(raw);
if (esConfirmacion || esAgendaPersonal || esAltaMasivaConDatos) ruta = 'crm';
const texto = advisorClientText || ((esConfirmacion || esAgendaPersonal || esAltaMasivaConDatos) ? raw : ((typeof p.texto === 'string' && p.texto.trim()) ? p.texto.trim() : raw));
return [{ json: { ruta, texto, intencionCrmTurnoActual } }];`;

function run(input, modelRoute = 'completar', modelText = 'respuesta vieja') {
  const code = patchCurrentTurnCrmInterpreter(fixture);
  const execute = new Function(
    '$input',
    `const raw=$input.raw;
     const p={ruta:$input.modelRoute,texto:$input.modelText};
     const advisorClientText='';
     const _looksLikeBulkLeadInput=()=>false;
     ${code}`,
  );
  return execute({ raw: input, modelRoute, modelText })[0].json;
}

function expectCrmRaw(raw, kind, modelRoute = 'correccion') {
  assert.deepEqual(run(raw, modelRoute), {
    ruta: 'crm',
    texto: raw,
    intencionCrmTurnoActual: kind,
  });
}

test('patch is scoped, syntax-valid, and idempotent', () => {
  const once = patchCurrentTurnCrmInterpreter(fixture);
  assert.match(once, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal(patchCurrentTurnCrmInterpreter(once), once);
});

test('explicit individual create with one phone overrides stale history', () => {
  expectCrmRaw(
    'Registra un cliente: Laura Méndez, teléfono +57 300 123 4567',
    'individual_create',
    'completar',
  );
  expectCrmRaw('Créame este cliente Pedro Ruiz 55 1234 5678', 'individual_create');
  expectCrmRaw('Agrégame a Sara Díaz como cliente, celular 300-555-0199', 'individual_create');
  expectCrmRaw(
    'Registra al cliente QA-20260923-WRITES Detalle con telefono 12025550202, correo qa-writes@example.invalid, presupuesto 250000 USD, proyecto Portofino, campaña BAY VIEW GRAND y nota QA-20260923-WRITES alta detallada.',
    'individual_create',
    'completar',
  );
});

test('current-turn next action overrides stale correction', () => {
  expectCrmRaw(
    'Pon como próxima acción de Diana Prueba llamarla mañana a las 9',
    'next_action',
  );
});

test('stage, zoom, and visit commands stay on CRM with raw text', () => {
  expectCrmRaw('Mueve al cliente Diana Prueba a Seguimiento', 'stage');
  expectCrmRaw('Agenda un Zoom con Diana Prueba mañana a las 3', 'zoom', 'equipo');
  expectCrmRaw('Programa una visita con Diana Prueba el viernes a las 11', 'visit', 'completar');
});

test('case note and expediente commands stay on CRM', () => {
  expectCrmRaw(
    'Agrega una nota al expediente del cliente Diana Prueba: prefiere Tulum',
    'case_note',
  );
});

test('first-person reminder commands override team/completion history', () => {
  expectCrmRaw('Recuérdame llamar a Diana mañana a las 8:40', 'personal_reminder', 'equipo');
  expectCrmRaw('Avísame revisar el contrato el viernes', 'personal_reminder', 'completar');
});

test('phone or client mention alone does not override history', () => {
  assert.deepEqual(run('El teléfono del cliente Laura es 300 123 4567'), {
    ruta: 'completar',
    texto: 'respuesta vieja',
    intencionCrmTurnoActual: '',
  });
});

test('notes, tasks, and interactions are not mistaken for client creation', () => {
  const messages = [
    'Agrega una nota al cliente Laura 300 123 4567: prefiere Tulum',
    'Crea una tarea para llamar al cliente Laura 300 123 4567 mañana',
    'Registra una llamada con el cliente Laura 300 123 4567',
  ];
  assert.equal(run(messages[0], 'correccion').intencionCrmTurnoActual, 'case_note');
  for (const message of messages.slice(1)) {
    const result = run(message, 'correccion');
    assert.equal(result.intencionCrmTurnoActual, '', message);
    assert.equal(result.ruta, 'correccion', message);
  }
});

test('team task preambles and delegated reminders are negative controls', () => {
  const messages = [
    'Crea una tarea para Juana: poner como próxima acción de Diana llamarla mañana',
    'Pídele a QA Asesor Uno agendar un Zoom con Diana mañana',
    'Asigna una actividad al equipo: mover al cliente Diana a Seguimiento',
    'Recuérdale a Juana llamar a Diana mañana a las 8:40',
    'Avísale al asesor que programe una visita con Diana',
  ];
  for (const message of messages) {
    const result = run(message, 'equipo');
    assert.equal(result.intencionCrmTurnoActual, '', message);
    assert.equal(result.ruta, 'equipo', message);
  }
});

test('zero or multiple phones stay out of the individual-create signature', () => {
  assert.equal(run('Registra un cliente Laura Méndez').intencionCrmTurnoActual, '');
  assert.equal(
    run('Registra clientes Laura 300 123 4567 y Pedro 300 987 6543').intencionCrmTurnoActual,
    '',
  );
});

test('patch fails closed when the live interpreter anchors drift', () => {
  assert.throws(
    () => patchCurrentTurnCrmInterpreter(fixture.replace('esAltaMasivaConDatos', 'bulkChanged')),
    /Interpreter changed/,
  );
});
