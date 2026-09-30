import { descargarArchivo } from './native'
/**
 * lib/backup.js — Respaldo manual de la base de datos
 *
 * Genera una exportación JSON limitada por permisos de la sesión:
 *   · profiles (usuarios)
 *   · leads (clientes)
 *   · audit_log (eventos accesibles, paginados)
 *   · organizations (multi-tenant)
 *
 * Solo accesible para super_admin / admin.
 *
 * Uso: const { ok, error, filename } = await downloadBackup()
 *
 * El archivo se descarga directamente al equipo del usuario en formato JSON.
 * Recuperación de desastres: docs/operacion/RECUPERACION.md.
 * Este export no contiene esquema, Auth ni archivos de Storage.
 */
import { supabase } from './supabase'
import { fetchAllRows } from './financial-data'

const TIMEOUT_MS = 15000   // 15 s — más generoso porque puede ser mucha data


/**
 * Exporta las filas visibles de cuatro tablas del CRM. No sirve para restaurar toda la plataforma.
 * Devuelve { ok, error, filename, stats }.
 */
export async function downloadBackup() {
  try {
    // Export every accessible row. RLS scope remains in force; this is not disaster recovery.
    const [profiles, leads, audit, orgs] = await Promise.all(
      ['profiles', 'leads', 'audit_log', 'organizations'].map(table =>
        fetchAllRows(() => supabase.from(table).select('*').order('id')
          .abortSignal(AbortSignal.timeout(TIMEOUT_MS))))
    )

    // Si alguna query falló, abortar
    for (const r of [profiles, leads, audit, orgs]) {
      if (r?.error) {
        return { ok: false, error: `Error al leer datos: ${r.error.message}` }
      }
    }

    const backup = {
      version:      '2.0',
      scope: 'CRM rows visible to the authenticated account (RLS)',
      complete_system_backup: false,
      excludes: ['auth credentials', 'storage files', 'database schema and policies', 'n8n workflows and credentials', 'other business tables'],
      consistency: 'paginated live export; not a transactional database snapshot',
      generated_at: new Date().toISOString(),
      app:          'Stratos AI CRM',
      stats: {
        profiles:      profiles.data?.length ?? 0,
        leads:         leads.data?.length ?? 0,
        audit_log:     audit.data?.length ?? 0,
        organizations: orgs.data?.length ?? 0,
      },
      data: {
        profiles:      profiles.data ?? [],
        leads:         leads.data ?? [],
        audit_log:     audit.data ?? [],
        organizations: orgs.data ?? [],
      },
    }

    const ts = new Date().toISOString().split('T')[0]   // 2026-04-27
    const filename = `stratos-backup-${ts}.json`

    // Dentro de la app el <a download> se ignora en silencio. descargarArchivo
    // guarda y abre el menu de compartir; en el navegador hace lo de siempre.
    await descargarArchivo(filename, JSON.stringify(backup, null, 2), 'application/json')

    return { ok: true, error: null, filename, stats: backup.stats }
  } catch (e) {
    if (e?.message?.startsWith('__TIMEOUT__')) {
      return {
        ok: false,
        error: 'El servicio está respondiendo lento. Intenta de nuevo en 1 minuto.',
      }
    }
    return { ok: false, error: e?.message || 'Error inesperado al generar el respaldo.' }
  }
}
