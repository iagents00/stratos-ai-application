/**
 * lib/auth.js — Autenticación con Supabase Auth
 * Misma interfaz { data, error } que la versión localStorage.
 * AuthContext.jsx no necesita cambios.
 */
import { supabase } from './supabase'

export function seedDemoUser() {
  // Ya no se usa — usuarios viven en Supabase
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { data: null, error: error.message }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, name, role, phone, active')
    .eq('id', data.user.id)
    .single()

  if (profileError || !profile) {
    return { data: null, error: 'No se encontró tu perfil. Contacta al administrador.' }
  }
  if (profile.active === false) {
    return { data: null, error: 'Cuenta desactivada. Contacta al administrador.' }
  }

  return {
    data: {
      id:    profile.id,
      name:  profile.name,
      email: data.user.email,
      role:  profile.role,
      phone: profile.phone,
    },
    error: null
  }
}

export async function signUp(name, email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, role: 'asesor' } }
  })
  if (error) return { data: null, error: error.message }

  return {
    data: {
      id:    data.user.id,
      name,
      email: data.user.email,
      role:  'asesor',
    },
    error: null
  }
}

export async function signOut() {
  await supabase.auth.signOut()
  return { error: null }
}

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/?reset=true`,
  })
  if (error) return { data: null, error: error.message }
  return {
    data: { message: 'Revisa tu correo — te enviamos el link para restablecer tu contraseña.' },
    error: null
  }
}

export async function getStoredSession() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, role, phone, active')
    .eq('id', session.user.id)
    .single()

  if (!profile || profile.active === false) return null

  return {
    id:    profile.id,
    name:  profile.name,
    email: session.user.email,
    role:  profile.role,
    phone: profile.phone,
  }
}

/* ── Funciones admin ─────────────────────────────────────── */
export async function adminGetAllUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, role, phone, active, created_at')
    .order('created_at')
  return error ? [] : data
}

export async function adminUpdateUser(id, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  return { data, error: error?.message ?? null }
}

export async function adminDeleteUser(id, currentUserId) {
  if (id === currentUserId) return { error: 'No puedes desactivar tu propia cuenta.' }
  const { error } = await supabase
    .from('profiles')
    .update({ active: false })
    .eq('id', id)
  return { error: error?.message ?? null }
}

export function adminCreateUser() {
  return { data: null, error: 'Crear usuarios desde Supabase Dashboard → Authentication → Users' }
}
export function adminResetPassword() {
  return { data: null, error: 'Resetear desde Supabase Dashboard → Authentication → Users' }
}
