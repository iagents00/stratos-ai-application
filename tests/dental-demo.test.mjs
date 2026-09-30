import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_APPOINTMENTS, availableHours, demoReply } from '../src/dental-demo/model.js';
test('booking a demo slot removes availability without altering original fixtures', () => {
  assert.ok(availableHours(INITIAL_APPOINTMENTS).includes('11:00'));
  const updated = [...INITIAL_APPOINTMENTS, { time: '11:00', status: 'Por confirmar' }];
  assert.ok(!availableHours(updated).includes('11:00'));
  assert.equal(INITIAL_APPOINTMENTS.length, 3);
});
test('Huli and reminder requests clearly remain simulated', () => {
  assert.match(demoReply('¿Está conectado a Huli?', INITIAL_APPOINTMENTS).reply, /no se envían a Huli/);
  assert.match(demoReply('Ejemplo de recordatorio', INITIAL_APPOINTMENTS).reply, /no se envía/);
  assert.deepEqual(demoReply('Consultar horarios', INITIAL_APPOINTMENTS).slots, ['11:00', '13:00', '16:00']);
});

import { isDentalProfile, DENTAL_DEMO_USER, DENTAL_DEMO_LEADS } from '../src/dental-demo/profile-data.js';
test('dental profile routes never replace other clients', () => {
  assert.equal(isDentalProfile({ pathname:'/clinica-dental-demo',search:'' }), true);
  assert.equal(isDentalProfile({ pathname:'/demo-dental',search:'' }), true);
  assert.equal(isDentalProfile({ pathname:'/',search:'?client=clinica-dental-demo' }), true);
  for (const pathname of ['/', '/duke', '/vega', '/grupo28']) assert.equal(isDentalProfile({pathname,search:''}),false);
});
test('dental demo uses independent identity and explicitly fictitious records', () => {
  assert.notEqual(DENTAL_DEMO_USER.id, 'demo-user-local');
  assert.equal(DENTAL_DEMO_USER.isDemo, true);
  assert.ok(DENTAL_DEMO_LEADS.every(p=>p.n.startsWith('Paciente Demo') && !p.phone && !p.email));
  assert.ok(DENTAL_DEMO_LEADS.every(p=>!['Zoom Agendado','Apartó','Cierre'].includes(p.st)));
});
