import test from 'node:test';
import assert from 'node:assert/strict';
import { findCreateProperties, orderedCreateProperties } from '../src/app/views/LandingPages/create-workflow.js';
const properties = [{ id: 'a', name: 'Bahía', location: 'Cancún', bedrooms: '2 recámaras' }, { id: 'b', name: 'Bosque', location: 'Tulum' }, { id: 'c', name: 'Centro', location: 'Cancún' }];
test('search combines words, ignores accents and keeps selection independent', () => {
  assert.deepEqual(findCreateProperties(properties, '  cancun BAHIA ', ['c']), [properties[0]]);
  assert.deepEqual(findCreateProperties(properties, '', ['c'], true), [properties[2]]);
  assert.deepEqual(findCreateProperties(properties, 'Tulum', ['c'], true), []);
});
test('preview and published payload use advisor selection order, omit missing ids and duplicates', () => {
  assert.deepEqual(orderedCreateProperties(properties, ['c', 'a', 'missing', 'c']), [properties[2], properties[0]]);
  assert.deepEqual(orderedCreateProperties(properties, []), []);
});
test('optional budget includes overlapping ranges and unknown prices without dropping prior selection', () => {
  const source = [{ id: 'low', priceFrom: 100, priceTo: 200 }, { id: 'high', priceFrom: 300, priceTo: 500 }, { id: 'unknown' }];
  assert.deepEqual(findCreateProperties(source, '', [], false, {min: 150, max: 250}).map(p=>p.id), ['low', 'unknown']);
  assert.deepEqual(findCreateProperties(source, '', [], false, {min: 500, max: 100}), []);
  assert.equal(findCreateProperties(source, '', [], false).length, 3);
});
