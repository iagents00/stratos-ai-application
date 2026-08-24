/**
 * lib/telefono.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Los dos enlaces que abren una conversación con un cliente: el marcador y
 * WhatsApp. Se ven parecidos y NO lo son, y de ahí sale el bug clásico.
 *
 *   tel:   → acepta el número casi como venga. Si trae "+", se respeta; si no,
 *            dígitos pelados y el sistema operativo lo interpreta.
 *   wa.me  → EXIGE código de país. Sin él, WhatsApp abre un chat vacío con un
 *            número que no existe, y el asesor cree que el cliente no le
 *            contesta.
 *
 * Por eso un número de 10 dígitos sin lada se asume de Estados Unidos (+1): la
 * mayoría de los clientes de Duke lo son. Si el número ya trae "+", se respeta
 * lo que el asesor capturó y no se adivina nada.
 *
 * Esto vivía suelto dentro de un componente del expediente. Está acá porque
 * Mi Día necesitaba exactamente lo mismo, y dos copias de una regla con
 * asunciones de país es de las que se desincronizan sin que nadie lo note.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Enlace para el marcador. Devuelve null si no hay nada que marcar. */
export function hrefLlamada(telefono) {
  const limpio = String(telefono || "").replace(/[^0-9+]/g, "");
  return limpio ? `tel:${limpio}` : null;
}

/** Los dígitos que wa.me necesita, con código de país. "" si no hay número. */
export function digitosWhatsApp(telefono) {
  const crudo = String(telefono || "");
  const digitos = crudo.replace(/[^0-9]/g, "");
  if (!digitos) return "";
  if (crudo.trim().startsWith("+")) return digitos;   // el asesor puso lada explícita
  if (digitos.length === 10) return `1${digitos}`;    // 10 sin lada → USA
  return digitos;                                      // el resto lo decide wa.me
}

/** Enlace de WhatsApp, con mensaje opcional. Devuelve null si no hay número. */
export function hrefWhatsApp(telefono, texto) {
  const d = digitosWhatsApp(telefono);
  if (!d) return null;
  return texto
    ? `https://wa.me/${d}?text=${encodeURIComponent(texto)}`
    : `https://wa.me/${d}`;
}

/**
 * El enlace correcto para el canal que sugiere la acción del día. Devuelve
 * `{ href, externo }` — `externo` marca si hay que abrirlo en otra pestaña
 * (wa.me sí; tel: no, o el navegador deja una pestaña en blanco colgando).
 */
export function hrefDelCanal(canal, telefono, texto) {
  if (canal === "whatsapp") {
    const href = hrefWhatsApp(telefono, texto);
    return href ? { href, externo: true } : null;
  }
  const href = hrefLlamada(telefono);
  return href ? { href, externo: false } : null;
}
