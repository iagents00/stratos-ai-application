/**
 * lib/auth.js — Autenticación con Supabase Auth
 * Misma interfaz { data, error } que antes.
 * Todas las funciones capturan errores de red y los devuelven de forma limpia.
 */
import { supabase } from './supabase'

export function seedDemoUser() {
  // Ya no se usa — usuarios viven en Supabase
}

export async function signIn(email, password) {
  try {
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
      error: null,
    }
  } catch (e) {
    return { data: null, error: 'Error de conexión. Verifica tu internet e inténtalo de nuevo.' }
  }
}

export async function signUp(name, email, password) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role: 'asesor' } },
    })
    if (error) return { data: null, error: error.message }

    return {
      data: {
        id:    data.user.id,
        name,
        email: data.user.email,
        role:  'asesor',
      },
      error: null,
    }
  } catch (e) {
    return { data: null, error: 'Error de conexión al registrarse. Inténtalo de nuevo.' }
  }
}

export async function signOut() {
  try {
    await supabase.auth.signOut()
  } catch (e) {
    console.warn('[Stratos] signOut error (ignorado):', e.message)
  }
  return { error: null }
}

export async function resetPassword(email) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/?reset=true`,
    })
    if (error) return { data: null, error: error.message }
    return {
      data: { message: 'Revisa tu correo — te enviamos el link para restablecer tu contraseña.' },
      error: null,
    }
  } catch (e) {
    return { data: null, error: 'Error de conexión. Verifica tu internet e inténtalo de nuevo.' }
  }
}

export async function getStoredSession() {
  try {
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
  } catch (e) {
    console.warn('[Stratos] getStoredSession error:', e.message)
    return null
  }
}

/* ── Funciones admin ─────────────────────────────────────── */
export async function adminGetAllUsers() {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, role, phone, active, created_at')
      .order('created_at')
    return error ? [] : data
  } catch (e) {
    console.warn('[Stratos] adminGetAllUsers error:', e.message)
    return []
  }
}

export async function adminUpdateUser(id, updates) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    return { data, error: error?.message ?? null }
  } catch (e) {
    return { data: null, error: 'Error de conexión al actualizar usuario.' }
  }
}

export async function adminDeleteUser(id, currentUserId) {
  if (id === currentUserId) return { error: 'No puedes desactivar tu propia cuenta.' }
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ active: false })
      .eq('id', id)
    return { error: error?.message ?? null }
  } catch (e) {
    return { error: 'Error de conexión al desactivar usuario.' }
  }
}

export function adminCreateUser() {
  return { data: null, error: 'Crear usuarios desde Supabase Dashboard → Authentication → Users' }
}
export function adminResetPassword() {
  return { data: null, error: 'Resetear desde Supabase Dashboard → Authentication → Users' }
}
