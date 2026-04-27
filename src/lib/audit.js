/**
 * lib/audit.js — Cliente del sistema de auditoría
 *
 * Para cambios en tablas (leads, profiles): los triggers de Postgres registran
 * automáticamente. No necesitas llamar nada desde el frontend.
 *
 * Para eventos de auth (login, signup, logout): usa logAuthEvent() — Supabase Auth
 * vive fuera de las tablas auditadas por triggers, así que registramos
 * manualmente desde el cliente.
 *
 * Para mostrar el historial de una entidad: usa getEntityHistory().
 */
import { supabase } from './supabase'

/**
 * Registra un evento de autenticación.
 * Es best-effort: si falla, no rompe el flujo principal de auth.
 *
 * @param {'LOGIN'|'LOGIN_FAIL'|'LOGOUT'|'SIGNUP'|'PASSWORD_RESET'} action
 * @param {string|null} actorId  uuid del usuario, o null si aún no hay sesión
 * @param {object} metadata      datos extra: { email, reason, ... }
 */
export async function logAuthEvent(action, actorId, metadata = {}) {
  try {
    await supabase.from('audit_log').insert({
      actor_id:      actorId,
      actor_name:    metadata.name || null,
      entity_type:   'auth',
      entity_id:     null,
      action,
      changed_fields: null,
      metadata: {
        ...metadata,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        timestamp:  new Date().toISOString(),
      },
    })
  } catch (e) {
    // No queremos que un fallo de logging bloquee el login
    console.warn('[audit] logAuthEvent failed:', e?.message)
  }
}

/**
 * Recupera el historial de cambios de una entidad.
 * Usa la RPC `get_entity_history` para respetar RLS y limitar resultados.
 *
 * @param {'leads'|'profiles'} entityType  nombre de la tabla
 * @param {string} entityId                uuid del registro
 * @param {number} limit                   default 50, máx 500
 * @returns {Promise<{data: Array, error: string|null}>}
 */
export async function getEntityHistory(entityType, entityId, limit = 50) {
  if (!entityType || !entityId) {
    return { data: [], error: 'entityType y entityId son requeridos' }
  }
  try {
    const { data, error } = await supabase.rpc('get_entity_history', {
      p_entity_type: entityType,
      p_entity_id:   entityId,
      p_limit:       limit,
    })
    if (error) return { data: [], error: error.message }
    return { data: data || [], error: null }
  } catch (e) {
    return { data: [], error: e?.message || 'Error de conexión' }
  }
}

/**
 * Recupera los últimos N eventos de auth (solo admins por RLS).
 * Útil para el dashboard de seguridad.
 */
export async function getRecentAuthEvents(limit = 100) {
  try {
    const { data, error } = await supabase
      .from('audit_log')
      .select('id, created_at, actor_id, actor_name, action, metadata')
      .eq('entity_type', 'auth')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) return { data: [], error: error.message }
    return { data: data || [], error: null }
  } catch (e) {
    return { data: [], error: e?.message || 'Error de conexión' }
  }
}

/**
 * Formatea un campo del audit_log para mostrarlo en UI.
 * Convierte nombres técnicos de columna a etiquetas legibles.
 */
const FIELD_LABELS = {
  // leads
  name:             'Nombre',
  stage:            'Etapa',
  score:            'Score',
  hot:              'Hot',
  is_new:           'Nuevo',
  budget:           'Presupuesto (texto)',
  presupuesto:      'Presupuesto',
  project:          'Proyecto',
  campaign:         'Campaña',
  source:           'Fuente',
  next_action:      'Próxima acción',
  next_action_date: 'Fecha próxima acción',
  last_activity:    'Última actividad',
  days_inactive:    'Días inactivo',
  seguimientos:     'Seguimientos',
  notas:            'Notas',
  bio:              'Bio',
  risk:             'Riesgo',
  friction:         'Fricción',
  tag:              'Etiqueta',
  ai_agent:         'Agente IA',
  priority:         'Prioridad',
  priority_order:   'Orden prioridad',
  asesor_name:      'Asesor',
  phone:            'Teléfono',
  email:            'Email',
  action_history:   'Historial',
  tasks:            'Tareas',
  deleted_at:       'Eliminado',
  // profiles
  role:             'Rol',
  active:           'Activo',
}

export function fieldLabel(key) {
  return FIELD_LABELS[key] || key
}

/**
 * Formatea una acción del audit_log a un texto legible en español.
 */
export function actionLabel(action) {
  switch (action) {
    case 'INSERT':         return 'Creado'
    case 'UPDATE':         return 'Modificado'
    case 'DELETE':         return 'Eliminado'
    case 'SOFT_DELETE':    return 'Archivado'
    case 'LOGIN':          return 'Inicio de sesión'
    case 'LOGIN_FAIL':     return 'Intento fallido'
    case 'LOGOUT':         return 'Cierre de sesión'
    case 'SIGNUP':         return 'Registro de cuenta'
    case 'PASSWORD_RESET': return 'Recuperación de contraseña'
    default: return action
  }
}
