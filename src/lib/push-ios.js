const RETRY_MS = 15_000;
const REFRESH_MS = 60 * 60 * 1000;

// El puente vive durante toda la apertura de la app. Un cambio de vista o
// una pausa de React no debe desregistrar el dispositivo en el servidor.
export function crearRegistroPushIOS(plugin, guardar, desvincular) {
  let sesion;
  let cerrando;
  let oyentes;
  let motivo = 'todavia-no-se-intento';
  const observadores = new Set();

  function informar(valor) {
    motivo = valor;
    observadores.forEach(observar => observar());
  }

  function escuchar() {
    if (!oyentes) {
      oyentes = (async () => {
        const instalados = [];
        try {
          instalados.push(await plugin.addListener('registration', ({ value }) => {
            const actual = sesion;
            if (!actual || !value) return;
            actual.token = value;
            actual.solicitudHasta = 0;
            confirmar(actual);
          }));
          instalados.push(await plugin.addListener('registrationError', (error) => {
            if (!sesion) return;
            sesion.solicitudHasta = Date.now() + RETRY_MS;
            informar('el-sistema-rechazo-el-registro: ' + String(error?.error || error));
          }));
          instalados.push(await plugin.addListener('pushNotificationActionPerformed', (accion) => {
            sesion?.alTocar?.(accion?.notification?.data || {});
          }));
        } catch (error) {
          await Promise.allSettled(instalados.map(oyente => oyente.remove()));
          oyentes = undefined;
          throw error;
        }
      })();
    }
    return oyentes;
  }

  function confirmar(actual) {
    if (actual.guardando) return actual.guardando;
    const token = actual.token;
    if (sesion !== actual || !token) return Promise.resolve(false);
    informar('guardando-registro');
    actual.guardando = Promise.resolve().then(() => guardar(actual.id, token)).catch(() => false)
      .then(ok => {
        if (sesion !== actual) return false;
        if (ok) actual.guardado = token;
        if (actual.token !== token) return false;
        actual.confirmadoHasta = ok ? Date.now() + REFRESH_MS : 0;
        informar(ok ? 'registrado' : 'el-telefono-dio-su-numero-pero-no-se-pudo-guardar');
        return ok;
      }).finally(() => {
        actual.guardando = null;
        if (sesion === actual && actual.token !== token) confirmar(actual);
      });
    return actual.guardando;
  }

  async function intentar(actual) {
    try {
      let permiso = await plugin.checkPermissions();
      if (sesion !== actual) return false;
      if (permiso?.receive === 'prompt' || permiso?.receive === 'prompt-with-rationale') {
        permiso = await plugin.requestPermissions();
      }
      if (sesion !== actual) return false;
      if (permiso?.receive !== 'granted') {
        informar('permiso-de-avisos-no-concedido: ' + String(permiso?.receive));
        return false;
      }

      if (actual.token && actual.token !== actual.guardado) return confirmar(actual);
      await escuchar();
      if (sesion !== actual) return false;
      actual.solicitudHasta = Date.now() + RETRY_MS;
      informar('esperando-que-el-sistema-de-el-numero');
      await plugin.register();
      if (sesion !== actual) return false;
      return actual.guardando ? await actual.guardando : motivo === 'registrado';
    } catch (error) {
      if (sesion === actual) informar('fallo-al-registrar: ' + (error?.message || error));
      return false;
    }
  }

  function iniciar(id, alTocar) {
    if (!id || cerrando) return Promise.resolve(false);
    if (sesion?.id !== id) sesion = { id, confirmadoHasta: 0, solicitudHasta: 0 };
    const actual = sesion;
    if (alTocar) actual.alTocar = alTocar;
    if (actual.intento) return actual.intento;
    if (actual.guardando) return actual.guardando;
    if (actual.confirmadoHasta > Date.now()) return Promise.resolve(true);
    if (actual.solicitudHasta > Date.now()) return Promise.resolve(false);
    actual.intento = intentar(actual).finally(() => { actual.intento = null; });
    return actual.intento;
  }

  async function detener(id) {
    if (sesion?.id !== id) return;
    const actual = sesion;
    cerrando = true;
    sesion = undefined;
    informar('sin-sesion');
    // El logout espera la escritura anterior antes de quitar el vínculo.
    await actual.guardando;
    try {
      if (actual.token) await desvincular(id, actual.token);
    } finally {
      try { await plugin.unregister(); } finally { cerrando = false; }
    }
  }

  return {
    iniciar,
    detener,
    motivo: () => motivo,
    observar(observar) {
      observadores.add(observar);
      return () => observadores.delete(observar);
    },
  };
}
