import test from 'node:test';
import assert from 'node:assert/strict';
import { patchModelResilience } from './copilot-model-resilience.mjs';

const fixture = [
  ...['Intérprete', 'AI Agent', 'Agente Actividades'].map(name => ({ name, parameters: {} })),
  { name: 'Postgres Chat Memory', parameters: { contextWindowLength: 20 } },
  { name: 'Claude (suscripcion)', parameters: { options: { temperature: 0 } } },
  { name: 'OpenAI Chat Model', parameters: { options: {} } },
];

test('adds bounded retries, memory and token caps without mutating input', () => {
  const next = patchModelResilience(fixture);
  assert.equal(fixture[0].retryOnFail, undefined);
  for (const name of ['Intérprete', 'AI Agent', 'Agente Actividades']) {
    const node = next.find(item => item.name === name);
    assert.deepEqual([node.retryOnFail, node.maxTries, node.waitBetweenTries], [true, 2, 2000]);
  }
  assert.equal(next.find(item => item.name === 'Postgres Chat Memory').parameters.contextWindowLength, 12);
  assert.equal(next.find(item => item.name === 'Claude (suscripcion)').parameters.options.maxTokens, 600);
  assert.equal(next.find(item => item.name === 'OpenAI Chat Model').parameters.options.maxTokens, 1000);
  assert.equal(next.find(item => item.name === 'OpenAI Chat Model').parameters.model.value, 'gpt-4o-mini');
});

test('fails closed when workflow topology changes', () => {
  assert.throws(() => patchModelResilience(fixture.filter(x => x.name !== 'AI Agent')), /AI Agent/);
});
