import assert from 'node:assert/strict';
import test from 'node:test';
import { crearRegistroPushIOS } from '../src/lib/push-ios.js';

function dispositivo() {
  const eventos = new Map();
  return {
    eventos,
    registros: 0,
    bajas: 0,
    permiso: 'granted',
    async addListener(nombre, handler) {
      assert.equal(eventos.has(nombre), false);
      eventos.set(nombre, handler);
      return { remove: async () => { eventos.delete(nombre); } };
    },
    async checkPermissions() { return { receive: this.permiso }; },
    async register() { this.registros++; },
    async unregister() { this.bajas++; },
  };
}

const esperarEventos = () => new Promise(resolve => setImmediate(resolve));

test('el registro espera al token y reintenta guardarlo sin perder el callback de apertura', async () => {
  const telefono = dispositivo();
  const escritos = [];
  const abiertos = [];
  const registro = crearRegistroPushIOS(telefono, async (id, token) => {
    escritos.push([id, token]);
    return escritos.length > 1;
  });

  await Promise.all([registro.iniciar('a', data => abiertos.push(data)), registro.iniciar('a')]);
  assert.equal(telefono.registros, 1);
  assert.equal(registro.motivo(), 'esperando-que-el-sistema-de-el-numero');
  telefono.eventos.get('registration')({ value: 'token' });
  await esperarEventos();
  assert.match(registro.motivo(), /no-se-pudo-guardar/);

  assert.equal(await registro.iniciar('a'), true);
  assert.equal(registro.motivo(), 'registrado');
  assert.equal(telefono.registros, 1);
  assert.deepEqual(escritos, [['a', 'token'], ['a', 'token']]);
  telefono.eventos.get('pushNotificationActionPerformed')({ notification: { data: { view: 'copilot' } } });
  assert.deepEqual(abiertos, [{ view: 'copilot' }]);
});

test('vuelve a pedir registro al expirar la espera o recuperar el permiso', async t => {
  t.mock.method(Date, 'now', () => 0);
  const telefono = dispositivo();
  telefono.permiso = 'denied';
  const registro = crearRegistroPushIOS(telefono, async () => true);
  assert.equal(await registro.iniciar('a'), false);
  assert.equal(telefono.registros, 0);
  telefono.permiso = 'granted';
  await registro.iniciar('a');
  await registro.iniciar('a');
  assert.equal(telefono.registros, 1);
  Date.now.mock.mockImplementation(() => 16_000);
  await registro.iniciar('a');
  assert.equal(telefono.registros, 2);
});

test('cerrar sesión espera la escritura, retira solo ese token y permite vincular otra cuenta', async () => {
  const telefono = dispositivo();
  const cambios = [];
  let terminar;
  const registro = crearRegistroPushIOS(telefono, (id, token) => {
    cambios.push(['guardar', id, token]);
    return id === 'a' ? new Promise(resolve => { terminar = resolve; }) : Promise.resolve(true);
  }, async (id, token) => { cambios.push(['retirar', id, token]); });
  await registro.iniciar('a');
  telefono.eventos.get('registration')({ value: 'primero' });
  await esperarEventos();
  const salida = registro.detener('a');
  assert.equal(await registro.iniciar('a'), false);
  terminar(true);
  await salida;
  assert.equal(telefono.bajas, 1);
  assert.equal(registro.motivo(), 'sin-sesion');
  await registro.iniciar('b');
  telefono.eventos.get('registration')({ value: 'segundo' });
  await esperarEventos();
  assert.equal(registro.motivo(), 'registrado');
  assert.deepEqual(cambios, [
    ['guardar', 'a', 'primero'],
    ['retirar', 'a', 'primero'],
    ['guardar', 'b', 'segundo'],
  ]);
});

test('APNs recibe una alerta visible y un plazo distinto para avisos y llamadas', async t => {
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', par.privateKey);
  const secrets = {
    APNS_KEY_P8: Buffer.from(pkcs8).toString('base64'),
    APNS_KEY_ID: 'prueba',
    APNS_TEAM_ID: 'prueba',
  };
  t.mock.method(Date, 'now', () => 1_800_000_000_000);
  Object.defineProperty(globalThis, 'Deno', {
    configurable: true,
    value: { env: { get: name => secrets[name] } },
  });
  t.after(() => { delete globalThis.Deno; });
  const envios = [];
  t.mock.method(globalThis, 'fetch', async (url, opciones) => {
    envios.push({ url, headers: opciones.headers, body: JSON.parse(opciones.body) });
    return new Response(null, { status: 200 });
  });
  const { enviarAPNs } = await import('../supabase/functions/send-push/canales-nativos.ts');
  const telefonos = [{ token: 'prueba', platform: 'ios', entorno: 'production' }];
  const aviso = { title: 'Stratos AI', body: 'Recordatorio de prueba', tag: 'prueba', url: '/', view: 'copilot', leadId: null };
  assert.equal((await enviarAPNs(telefonos, aviso)).enviados, 1);
  assert.equal((await enviarAPNs(telefonos, { ...aviso, kind: 'llamada' })).enviados, 1);
  assert.equal(envios[0].url, 'https://api.push.apple.com/3/device/prueba');
  assert.equal(envios[0].headers['apns-push-type'], 'alert');
  assert.equal(envios[0].headers['apns-priority'], '10');
  assert.equal(envios[0].body.aps.alert.body, aviso.body);
  assert.equal(envios[0].headers['apns-expiration'], '1800086400');
  assert.equal(envios[1].headers['apns-expiration'], '1800000060');
});
