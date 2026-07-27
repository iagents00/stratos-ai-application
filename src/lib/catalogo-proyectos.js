/**
 * catalogo-proyectos.js — El catálogo de desarrollos, EDITABLE desde el CRM
 * ─────────────────────────────────────────────────────────────────────────────
 * ANTES: el catálogo vivía SOLO en src/app/data/catalogoProyectos.js, un archivo
 * auto-generado del Google Sheet «DRIVES DUKE DEL CARIBE». Para dar de alta un
 * desarrollo, el equipo de Duke mandaba la carpeta de Drive y alguien regeneraba
 * el archivo a mano. El equipo no podía actualizar sus propios proyectos.
 *
 * AHORA: la fuente de verdad es la tabla `public.catalogo_proyectos` de Supabase
 * (stratos-prod, org-scoped por RLS) — la MISMA que ya lee el asistente de
 * Telegram / Copilot en `bot_buscar_proyectos`. Registrar un proyecto desde
 * Proyectos o Create escribe ahí, así que aparece de una en las tres superficies:
 * el módulo Proyectos, el selector de Create y el bot.
 *
 * El archivo estático queda como SEMILLA de respaldo: si Supabase falla o la
 * tabla está vacía, la UI sigue mostrando el catálogo del repo (nunca pantalla
 * en blanco). Ver useCatalogo.js.
 *
 * ⚠️ Nada se borra nunca: "quitar" un proyecto es `visible = false` (queda en la
 * tabla y se puede volver a mostrar).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { supabase } from './supabase';

export const CATALOGO_TABLE = 'catalogo_proyectos';

// Sección con la que nacen los proyectos registrados desde el CRM. Es la misma
// que el Sheet marca como visible (ERP + bot muestran `visible = true`).
export const SECCION_CRM = 'top-desarrollos';
export const SECCION_CRM_NOMBRE = 'Top Desarrollos';

// Columnas que leemos (no traemos todo con * para no cargar de más).
const COLS = [
  'id', 'seccion', 'seccion_nombre', 'desarrollo', 'ubicacion', 'zona',
  'masterbroker', 'ticket', 'clasificacion', 'tipologia', 'entrega',
  'financiamiento', 'entrega_como', 'highlights', 'mantenimiento',
  'contacto', 'asesor', 'drive', 'maps', 'visible', 'created_at',
].join(', ');

// Campos de auditoría (quién registró / actualizó). Los agrega la migración
// 172_catalogo_editable_desde_crm.sql. Si todavía NO se aplicó, el guardado
// reintenta sin ellos — así la feature funciona antes y después de la migración.
const AUDIT_FIELDS = ['updated_at', 'created_by_name', 'updated_by_name'];

// ─── Links de Google Drive ───────────────────────────────────────────────────

const DRIVE_FOLDER_RE = /drive\.google\.com\/(?:drive\/)?(?:u\/\d+\/)?folders\/([-\w]{10,})/i;
const DRIVE_FILE_RE = /drive\.google\.com\/file\/d\/([-\w]{10,})/i;
const DRIVE_OPEN_RE = /drive\.google\.com\/open\?id=([-\w]{10,})/i;
const BARE_ID_RE = /^[-\w]{20,80}$/;

/**
 * Lee lo que pegó el usuario y devuelve el link normalizado.
 * Acepta las formas reales que manda el equipo:
 *   https://drive.google.com/drive/folders/<ID>
 *   https://drive.google.com/drive/u/0/folders/<ID>?usp=sharing
 *   https://drive.google.com/file/d/<ID>/view
 *   el <ID> pelado
 *   cualquier otro https:// (Dropbox, OneDrive… ya hay casos en el catálogo)
 *
 * → { ok, url, kind: 'folder'|'file'|'other', id, message }
 */
export function parseDriveLink(raw) {
  const s = (raw || '').trim();
  if (!s) return { ok: false, url: '', kind: null, id: null, message: 'Pega el enlace de la carpeta de Drive.' };

  const folder = s.match(DRIVE_FOLDER_RE);
  if (folder) {
    return { ok: true, kind: 'folder', id: folder[1], url: `https://drive.google.com/drive/folders/${folder[1]}`, message: '' };
  }

  const open = s.match(DRIVE_OPEN_RE);
  if (open) {
    return { ok: true, kind: 'folder', id: open[1], url: `https://drive.google.com/drive/folders/${open[1]}`, message: '' };
  }

  const file = s.match(DRIVE_FILE_RE);
  if (file) {
    return {
      ok: true, kind: 'file', id: file[1],
      url: `https://drive.google.com/file/d/${file[1]}/view`,
      message: 'Es un archivo suelto, no una carpeta. Mejor pega la carpeta completa del desarrollo.',
    };
  }

  if (BARE_ID_RE.test(s)) {
    return { ok: true, kind: 'folder', id: s, url: `https://drive.google.com/drive/folders/${s}`, message: '' };
  }

  if (/^https?:\/\//i.test(s)) {
    return { ok: true, kind: 'other', id: null, url: s, message: 'No es un enlace de Google Drive; se guarda igual.' };
  }

  return { ok: false, url: '', kind: null, id: null, message: 'No parece un enlace válido. Copia la URL desde el navegador (debe empezar con https://).' };
}

/** true si el link es una carpeta de Drive bien formada. */
export const isDriveFolder = (raw) => parseDriveLink(raw).kind === 'folder';

// ─── Mapeo tabla ↔ UI ────────────────────────────────────────────────────────

/** Fila de Supabase → el shape que ya consumen ERP y catalogAdapter. */
export const rowToItem = (row) => ({
  id: row.id,
  seccion: row.seccion || SECCION_CRM,
  seccionNombre: row.seccion_nombre || SECCION_CRM_NOMBRE,
  desarrollo: row.desarrollo || '',
  ubicacion: row.ubicacion || '',
  zona: row.zona || '',
  masterbroker: row.masterbroker || '',
  ticket: row.ticket || '',
  clasificacion: row.clasificacion || '',
  tipologia: row.tipologia || '',
  entrega: row.entrega || '',
  financiamiento: row.financiamiento || '',
  entregaComo: row.entrega_como || '',
  highlights: row.highlights || '',
  mantenimiento: row.mantenimiento || '',
  contacto: row.contacto || '',
  asesor: row.asesor || '',
  drive: row.drive || '',
  maps: row.maps || '',
  visible: row.visible !== false,
  createdAt: row.created_at || null,
  source: 'db',
});

const clean = (v) => {
  const s = (v == null ? '' : String(v)).trim();
  return s === '' ? null : s;
};

/** Shape de la UI → payload para Supabase. */
export const itemToRow = (item) => ({
  seccion: clean(item.seccion) || SECCION_CRM,
  seccion_nombre: clean(item.seccionNombre) || SECCION_CRM_NOMBRE,
  desarrollo: (item.desarrollo || '').trim(),
  ubicacion: clean(item.ubicacion),
  zona: clean(item.zona),
  masterbroker: clean(item.masterbroker),
  ticket: clean(item.ticket),
  clasificacion: clean(item.clasificacion),
  tipologia: clean(item.tipologia),
  entrega: clean(item.entrega),
  financiamiento: clean(item.financiamiento),
  entrega_como: clean(item.entregaComo),
  highlights: clean(item.highlights),
  mantenimiento: clean(item.mantenimiento),
  contacto: clean(item.contacto),
  asesor: clean(item.asesor),
  drive: clean(item.drive),
  maps: clean(item.maps),
  visible: item.visible !== false,
});

// ─── Lectura ─────────────────────────────────────────────────────────────────

// Tope de espera. Con la red caída, el SDK puede quedarse colgado decenas de
// segundos y el módulo se ve "Cargando…" todo ese tiempo. Mismo criterio que
// GETSESSION_TIMEOUT / INSERT_TIMEOUT_MS del resto del repo: cortar y seguir.
const FETCH_TIMEOUT_MS = 8000;

const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((resolve) => setTimeout(
    () => resolve({ data: null, count: null, error: { message: 'Tiempo de espera agotado leyendo el catálogo.' } }),
    ms,
  )),
]);

/**
 * Trae el catálogo vivo de Supabase.
 * → { items, total, error }
 *   items = solo los visibles (lo que ven asesores y bot)
 *   total = filas de la org (0 ⇒ la tabla no está cargada → la UI usa la semilla)
 */
export async function fetchCatalogo() {
  const { count, error: countError } = await withTimeout(
    supabase.from(CATALOGO_TABLE).select('id', { count: 'exact', head: true }),
    FETCH_TIMEOUT_MS,
  );

  if (countError) return { items: [], total: null, error: countError };
  if (!count) return { items: [], total: 0, error: null };

  const { data, error } = await withTimeout(
    supabase.from(CATALOGO_TABLE).select(COLS).eq('visible', true).order('desarrollo', { ascending: true }),
    FETCH_TIMEOUT_MS,
  );

  if (error) return { items: [], total: count, error };
  return { items: (data || []).map(rowToItem), total: count, error: null };
}

// ─── Escritura ───────────────────────────────────────────────────────────────

// PostgREST devuelve PGRST204 ("Could not find the 'x' column…") cuando el
// payload trae una columna que la tabla todavía no tiene.
const isUnknownColumn = (error) =>
  error?.code === 'PGRST204' || /column .* does not exist|schema cache/i.test(error?.message || '');

const stripAudit = (payload) => {
  const out = { ...payload };
  AUDIT_FIELDS.forEach((f) => delete out[f]);
  return out;
};

/**
 * Alta o edición de un desarrollo. Si `item.id` existe → UPDATE, si no → INSERT.
 * RLS exige rol admin/director o superior (política `catalogo_insert_admin` /
 * `catalogo_update_admin`); un asesor recibe error de permisos.
 * → { data, error }
 */
export async function saveProyecto(item, { organizationId, userName } = {}) {
  const base = itemToRow(item);
  if (!base.desarrollo) return { data: null, error: { message: 'Falta el nombre del desarrollo.' } };

  const stamp = new Date().toISOString();
  const editing = !!item.id;

  if (!editing && !organizationId) {
    return { data: null, error: { message: 'Tu usuario no tiene organización asignada, no se puede registrar el proyecto. Avísale a quien administre el CRM.' } };
  }

  const payload = editing
    ? { ...base, updated_at: stamp, updated_by_name: userName || null }
    : { ...base, organization_id: organizationId, updated_at: stamp, created_by_name: userName || null, updated_by_name: userName || null };

  const run = (body) => (editing
    ? supabase.from(CATALOGO_TABLE).update(body).eq('id', item.id).select(COLS).single()
    : supabase.from(CATALOGO_TABLE).insert(body).select(COLS).single());

  let { data, error } = await run(payload);
  // La migración de auditoría todavía no se aplicó → reintentar sin esos campos.
  if (error && isUnknownColumn(error)) ({ data, error } = await run(stripAudit(payload)));

  return { data: data ? rowToItem(data) : null, error };
}

/**
 * Mostrar / ocultar un desarrollo. NO borra: la fila queda en la tabla.
 * → { error }
 */
export async function setProyectoVisible(id, visible) {
  const { error } = await supabase
    .from(CATALOGO_TABLE)
    .update({ visible: !!visible })
    .eq('id', id);
  return { error };
}

/** Mensaje humano para los errores más comunes al guardar. */
export const explainSaveError = (error) => {
  if (!error) return '';
  const msg = error.message || '';
  if (error.code === '42501' || /row-level security|permission denied/i.test(msg)) {
    return 'Tu usuario no tiene permiso para editar el catálogo. Pídele a un administrador que lo registre.';
  }
  if (/Failed to fetch|NetworkError/i.test(msg)) {
    return 'No hay conexión con el servidor. Revisa tu internet y vuelve a intentar.';
  }
  return msg || 'No se pudo guardar. Intenta de nuevo.';
};
