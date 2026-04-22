/**
 * lib/auth.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Capa de abstracción de autenticación.
 *
 * ESTADO ACTUAL: Supabase
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase } from "./supabase";

/**
 * Inicia sesión con email y contraseña.
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data.user, error: null };
}

/**
 * Registra un nuevo usuario.
 */
export async function signUp(name, email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
        role: "asesor",
      },
    }
  });

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data.user, error: null };
}

/**
 * Cierra la sesión actual.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * Envía email de recuperación de contraseña.
 */
export async function resetPassword(email) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: { message: "Si el email existe, recibirás instrucciones." }, error: null };
}

/**
 * Lee la sesión activa.
 * Usado principalmente para hidratación inicial.
 */
export async function getStoredSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
}

// ─── ADMIN: GESTIÓN DE USUARIOS ──────────────────────────────────────────────
// Nota: Estas funciones requieren el service_role key o un servidor backend
// para ejecutarse mediante Auth Admin API. Para propósitos de este demo,
// las mapearemos a una tabla 'profiles' si existe, o las dejaremos como mocks
// que retornan error si no se tiene permisos de admin.

export function adminGetAllUsers() {
  // TODO: Fetch from 'profiles' table or use supabase.auth.admin.listUsers() (requires server key)
  return [];
}

export function adminCreateUser() {
  return { data: null, error: "Función administrativa no disponible sin Service Key." };
}

export function adminUpdateUser() {
  return { data: null, error: "Función administrativa no disponible sin Service Key." };
}

export function adminDeleteUser() {
  return { error: "Función administrativa no disponible sin Service Key." };
}

export function adminResetPassword() {
  return { data: null, error: "Función administrativa no disponible sin Service Key." };
}

export function seedDemoUser() {
  // No longer needed with Supabase
}

