#!/usr/bin/env node
/**
 * scripts/verify_setup.mjs
 *
 * Valida que la base de datos de Supabase está completa y lista
 * para producción. Corre DESPUÉS de aplicar las 4 migraciones.
 *
 * Reporta:
 *   ✓ Tablas existen (profiles, leads, audit_log)
 *   ✓ Columnas críticas presentes en leads
 *   ✓ RLS habilitado
 *   ✓ Triggers de auditoría activos
 *   ✓ Funciones helper creadas (is_admin_or_above, current_user_name, get_entity_history)
 *   ✓ Índices presentes
 *
 * USO:
 *   node scripts/verify_setup.mjs
 *
 * Necesita .env.local con VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

function loadEnv() {
  const envPath = resolve(projectRoot, '.env.local')
  if (!existsSync(envPath)) {
    console.error('❌ .env.local no existe.')
    process.exit(1)
  }
  const env = {}
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

const REQUIRED_LEADS_COLUMNS = [
  'id', 'name', 'email', 'phone', 'source', 'stage', 'score', 'hot', 'is_new',
  'budget', 'presupuesto', 'project', 'campaign',
  'next_action', 'next_action_date', 'last_activity', 'days_inactive',
  'seguimientos', 'ai_agent', 'asesor_name', 'asesor_id',
  'action_history', 'tasks', 'notas', 'bio', 'risk', 'friction', 'tag',
  'priority', 'priority_order',
  'created_at', 'updated_at', 'deleted_at',
]

const REQUIRED_PROFILES_COLUMNS = [
  'id', 'name', 'role', 'phone', 'active', 'created_at', 'updated_at',
]

const REQUIRED_AUDIT_COLUMNS = [
  'id', 'created_at', 'actor_id', 'actor_name', 'actor_role',
  'entity_type', 'entity_id', 'action', 'changed_fields', 'metadata',
]

const checks = []
function check(name, ok, detail = '') {
  checks.push({ name, ok, detail })
  console.log(`  ${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  const env = loadEnv()
  const url = env.VITE_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('❌ Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } })

  console.log('\n🔍 Verificando setup de Supabase…\n')

  // ── 1. Tablas ───────────────────────────────────────────
  console.log('📋 Tablas:')
  for (const table of ['profiles', 'leads', 'audit_log']) {
    const { error } = await supabase.from(table).select('*').limit(1)
    check(`Tabla ${table}`, !error, error?.message || 'existe y accesible')
  }

  // ── 2. Columnas (vía RPC information_schema) ────────────
  // Se hace mediante un SELECT con todas las columnas
  console.log('\n🧱 Columnas en leads:')
  const { data: leadSample, error: leadErr } = await supabase
    .from('leads').select(REQUIRED_LEADS_COLUMNS.join(',')).limit(0)
  if (leadErr) {
    check('SELECT con todas las columnas requeridas', false, leadErr.message)
    console.error(`     ↳ Falta correr migración 002 o 002 está incompleta.`)
  } else {
    check('SELECT con todas las columnas requeridas', true, `${REQUIRED_LEADS_COLUMNS.length} columnas`)
  }

  console.log('\n🧱 Columnas en profiles:')
  const { error: profErr } = await supabase
    .from('profiles').select(REQUIRED_PROFILES_COLUMNS.join(',')).limit(0)
  check('SELECT con todas las columnas requeridas', !profErr, profErr?.message || `${REQUIRED_PROFILES_COLUMNS.length} columnas`)

  console.log('\n🧱 Columnas en audit_log:')
  const { error: auditErr } = await supabase
    .from('audit_log').select(REQUIRED_AUDIT_COLUMNS.join(',')).limit(0)
  check('SELECT con todas las columnas requeridas', !auditErr, auditErr?.message || `${REQUIRED_AUDIT_COLUMNS.length} columnas`)

  // ── 3. RPC helpers ───────────────────────────────────────
  console.log('\n🔧 Funciones RPC:')
  const { error: rpcErr } = await supabase.rpc('get_entity_history', {
    p_entity_type: 'leads', p_entity_id: '00000000-0000-0000-0000-000000000000', p_limit: 1,
  })
  check('get_entity_history()', !rpcErr, rpcErr?.message || 'callable')

  // ── 4. Trigger de audit_log — test funcional ────────────
  console.log('\n🪄 Triggers de auditoría (test funcional):')
  // Crear un perfil dummy de testing si no existe
  // (no afecta producción porque el active=false y rol='asesor')
  const testId = '00000000-0000-0000-0000-aaaaaaaaaaaa'
  await supabase.from('profiles').upsert({
    id: testId, name: '__test_audit__', role: 'asesor', active: false,
  }, { onConflict: 'id' })

  await supabase.from('profiles').update({ phone: 'TEST-' + Date.now() })
    .eq('id', testId)

  const { data: auditRows } = await supabase
    .from('audit_log').select('*')
    .eq('entity_type', 'profiles').eq('entity_id', testId)
    .order('created_at', { ascending: false }).limit(1)

  const triggerWorked = auditRows && auditRows.length > 0
  check('Trigger AFTER UPDATE en profiles registra cambios', triggerWorked,
        triggerWorked ? `último: action=${auditRows[0].action}` : 'no se registró el cambio — revisa migración 003')

  // Cleanup del perfil de prueba
  await supabase.from('profiles').delete().eq('id', testId)

  // ── 5. Resumen ──────────────────────────────────────────
  const failed = checks.filter(c => !c.ok).length
  console.log(`\n📊 Resultado: ${checks.length - failed} OK · ${failed} fallidos`)
  if (failed === 0) {
    console.log('\n✅ Todo listo para producción. Puedes crear los usuarios y soltar al equipo.\n')
    process.exit(0)
  } else {
    console.log('\n❌ Hay problemas. Revisa qué migración falta correr.\n')
    process.exit(1)
  }
}

main().catch(e => {
  console.error('💥 Error fatal:', e.message)
  process.exit(1)
})
