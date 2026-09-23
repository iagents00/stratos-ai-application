import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isServiceUnavailableError,
  SERVICE_UNAVAILABLE_MESSAGE,
} from '../src/lib/service-errors.js'

test('clasifica fallas de infraestructura sin confundirlas con credenciales', () => {
  assert.equal(isServiceUnavailableError({ status: 522, message: 'Connection timed out' }), true)
  assert.equal(isServiceUnavailableError(new TypeError('Failed to fetch')), true)
  assert.equal(isServiceUnavailableError({ status: 500, message: 'Database error' }), true)
  assert.equal(isServiceUnavailableError({ status: 400, message: 'Invalid login credentials' }), false)
})

test('el mensaje de caída aclara que las credenciales no fueron rechazadas', () => {
  assert.match(SERVICE_UNAVAILABLE_MESSAGE, /credenciales no fueron rechazadas/i)
  assert.doesNotMatch(SERVICE_UNAVAILABLE_MESSAGE, /verifica tu internet/i)
})
