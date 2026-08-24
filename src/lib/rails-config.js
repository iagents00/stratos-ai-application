/**
 * lib/rails-config.js
 * ─────────────────────────────────────────────────────────────────────────────
 * LA CONFIGURACIÓN DE STRATOS RAILS — prender, apagar y personalizar.
 *
 * Vive en `organizations.meta_config.rails`, o sea EN LA BASE, no en el bundle.
 * Prender Rails para una empresa no requiere un deploy: es un switch que un
 * admin mueve y que el resto del equipo ve en su siguiente carga.
 *
 * ── LA REGLA DE ORO: FUSIONAR, NUNCA REEMPLAZAR ──────────────────────────────
 * Lo que la organización define manda; lo que NO define cae al default. Esto no
 * es un detalle de estilo: en julio se le cargó a NSG un `protocol` con 3 de sus
 * ~18 claves y la pantalla de Protocolo de Ventas reventó entera con "Cannot
 * read properties of undefined (reading 'map')" — una sola clave faltante tumbó
 * el módulo (ver [guard:META-MERGE-DEFAULTS] en App.jsx). Acá se aplica lo
 * mismo, y una regla más: guardar media configuración no puede romper nada.
 *
 * ── QUÉ SE PUEDE PERSONALIZAR ────────────────────────────────────────────────
 *   activo        · el interruptor grande. false = el CRM se ve como siempre.
 *   maxTarjetas   · cuántas acciones por día. El default es 7 a propósito.
 *   reglas[tipo]  · por cada regla del motor:
 *                     activa · apagarla sin tocar código (una constructora no
 *                              tiene Zooms; una inmobiliaria sí)
 *                     peso   · qué tan arriba aparece
 *                     razon  · POR QUÉ este cliente hoy — con tu voz
 *                     pedir  · QUÉ conseguir en ese contacto
 *
 * En `razon` y `pedir` se pueden usar fichas que se reemplazan solas:
 *   {nombre} {dias_txt} {dias} {diasVencida} {etapa} {faltantes}
 *   ({dias_txt} viene conjugado: "1 día" / "5 días")
 * ─────────────────────────────────────────────────────────────────────────────
 */

// El motor es el dueño de la forma del lead, así que la interpolación vive ahí
// y acá solo se reexporta para el panel. Una sola dirección: config → motor.
import { MAX_DEL_DIA, catalogoDeReglas } from "./next-action-engine";
export { interpolar, FICHAS_DISPONIBLES } from "./next-action-engine";

/** Lo que se usa cuando la organización no ha configurado nada. */
export const RAILS_DEFAULTS = Object.freeze({
  // Apagado de fábrica, a propósito. Prender Rails le reordena la pantalla a
  // todo un equipo de ventas: eso lo decide una persona, no un default.
  activo: false,
  maxTarjetas: MAX_DEL_DIA,
  reglas: {},
});

const TOPE_TARJETAS = 12;   // más que esto y deja de ser una lista terminable

/**
 * Fusiona lo guardado en la base sobre los defaults. Tolera basura: null,
 * objetos a medias, números fuera de rango, reglas que ya no existen en el
 * motor. Nunca lanza y nunca devuelve algo incompleto.
 */
export function fusionarRails(guardada) {
  const g = (guardada && typeof guardada === "object") ? guardada : {};

  const max = Number(g.maxTarjetas);
  const reglas = {};
  for (const r of catalogoDeReglas()) {
    const sobre = (g.reglas && typeof g.reglas === "object" && g.reglas[r.tipo]) || {};
    const peso = Number(sobre.peso);
    reglas[r.tipo] = {
      activa: sobre.activa !== false,                       // solo un false explícito apaga
      peso:   Number.isFinite(peso) ? clamp(peso, 0, 100) : r.peso,
      razon:  textoLimpio(sobre.razon),                     // null = usar el del motor
      pedir:  textoLimpio(sobre.pedir),
    };
  }

  return {
    activo: g.activo === true,
    maxTarjetas: Number.isFinite(max) ? clamp(Math.round(max), 1, TOPE_TARJETAS) : RAILS_DEFAULTS.maxTarjetas,
    reglas,
  };
}

/**
 * El inverso: deja solo lo que DIFIERE del default, para no guardar en la base
 * una copia entera de la configuración de fábrica. Así, si mañana mejoramos un
 * texto por defecto, las empresas que no lo tocaron reciben la mejora sola.
 */
export function compactarRails(cfg) {
  const salida = { activo: cfg.activo === true };
  if (cfg.maxTarjetas !== RAILS_DEFAULTS.maxTarjetas) salida.maxTarjetas = cfg.maxTarjetas;

  const reglas = {};
  for (const r of catalogoDeReglas()) {
    const c = cfg.reglas?.[r.tipo];
    if (!c) continue;
    const dif = {};
    if (c.activa === false)        dif.activa = false;
    if (c.peso !== r.peso)         dif.peso = c.peso;
    if (textoLimpio(c.razon))      dif.razon = c.razon.trim();
    if (textoLimpio(c.pedir))      dif.pedir = c.pedir.trim();
    if (Object.keys(dif).length)   reglas[r.tipo] = dif;
  }
  if (Object.keys(reglas).length) salida.reglas = reglas;
  return salida;
}

function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
function textoLimpio(v) {
  const t = typeof v === "string" ? v.trim() : "";
  return t.length ? t : null;
}
