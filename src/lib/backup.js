/**
 * lib/backup.js — Respaldo manual de la base de datos
 *
 * Genera un archivo JSON con todos los datos críticos del CRM:
 *   · profiles (usuarios)
 *   · leads (clientes)
 *   · audit_log (últimos 1000 eventos)
 *   · organizations (multi-tenant)
 *
 * Solo accesible para super_admin / admin.
 *
 * Uso: const { ok, error, filename } = await downloadBackup()
 *
 * El archivo se descarga directamente al equipo del usuario en formato JSON.
 * Restauración: el JSON puede importarse a otro Postgres o a una nueva
 * instancia de Supabase con un script de seed (no incluido aquí).
 */
import { supabase } from './supabase'

const TIMEOUT_MS = 15000   // 15 s — más generoso porque puede ser mucha data

function withTimeout(promise, ms = TIMEOUT_MS, label = 'backup') {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`__TIMEOUT__:${label}`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/**
 * Genera y descarga un respaldo completo del CRM en formato JSON.
 * Devuelve { ok, error, filename, stats }.
 */
export async function downloadBackup() {
  try {
    // Ejecutar las 4 queries en paralelo con timeout
    const [profiles, leads, audit, orgs] = await Promise.all([
      withTimeout(
        supabase.from('profiles').select('*').order('created_at', { ascending: true }),
        TIMEOUT_MS,
        'profiles',
      ),
      withTimeout(
        supabase.from('leads').select('*').order('created_at', { ascending: true }),
        TIMEOUT_MS,
        'leads',
      ),
      withTimeout(
        supabase
          .from('audit_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1000),
        TIMEOUT_MS,
        'audit_log',
      ),
      withTimeout(
        supabase.from('organizations').select('*'),
        TIMEOUT_MS,
        'organizations',
      ).catch(() => ({ data: [], error: null })),  // tabla puede no existir aún
    ])

    // Si alguna query falló, abortar
    for (const r of [profiles, leads, audit, orgs]) {
      if (r?.error) {
        return { ok: false, error: `Error al leer datos: ${r.error.message}` }
      }
    }

    const backup = {
      version:      '1.0',
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

    // Generar archivo descargable
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const ts = new Date().toISOString().split('T')[0]   // 2026-04-27
    const filename = `stratos-backup-${ts}.json`

    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

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
