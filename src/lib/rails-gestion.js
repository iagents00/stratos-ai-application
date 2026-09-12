/** Valida el borrador una vez; un envío incierto se reintenta sin alterar su payload. */
export function prepararGestion(borrador, ahora = Date.now()) {
  const detalle = String(borrador.detalle || '').trim();
  const siguiente = String(borrador.siguiente || '').trim();
  if (detalle.length < 3 || detalle.length > 2000) throw new Error('Describe qué ocurrió con al menos tres caracteres, sin contar espacios alrededor.');
  if (siguiente.length < 3 || siguiente.length > 1000) throw new Error('Describe el siguiente paso con al menos tres caracteres, sin contar espacios alrededor.');
  const fecha = Date.parse(borrador.fecha);
  if (!Number.isFinite(fecha) || fecha <= ahora) throw new Error('Elige una fecha y hora futuras para el siguiente paso.');
  return { ...borrador, detalle, siguiente, fecha: new Date(fecha).toISOString() };
}

/** Estos códigos implican rechazo antes del commit, no una respuesta perdida. */
export function rechazoDefinitivoRails(error) {
  return /^(P0001|23505|23514|23502|42501|22\w{3}|PGRST202|PGRST204)$/.test(error?.code || '');
}

/** Cierres ajenos evitan duplicados, pero no cuentan como trabajo propio. */
export function resumenAgenda(cerradas, actorId) {
  return Object.values(cerradas).reduce((cuenta, cierre) => {
    if (!actorId || cierre.asesor_id !== actorId) return cuenta;
    return { ...cuenta, [cierre.estado]: (cuenta[cierre.estado] || 0) + 1 };
  }, {});
}
