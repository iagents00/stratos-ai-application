/**
 * lib/auth.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Capa de abstracción de autenticación.
 *
 * ESTADO ACTUAL: localStorage (prototipo)
 * PRÓXIMO PASO:  Reemplazar cada función con la llamada equivalente de Supabase.
 *               Las interfaces de retorno ya están diseñadas para Supabase:
 *               { data, error } en todas las operaciones.
 *
 * MIGRACIÓN A SUPABASE:
 *   1. import { supabase } from './supabase'
 *   2. Reemplazar implementación localStorage con supabase.auth.*
 *   3. Las firmas de las funciones NO cambian → cero cambios en el UI.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const STORAGE_KEY = "stratos_user";
const USERS_KEY   = "stratos_users";

// ─── SEED — Usuarios demo pre-cargados ───────────────────────────────────────
const SEED_USERS = [
  { id: 1,  name: "Usuario Demo",     email: "demo@stratos.ai",        password: "Demo2024",    role: "admin" },
  { id: 2,  name: "Ivan Rodriguez",   email: "ivan@stratos.ai",        password: "Admin2024",   role: "super_admin" },
  { id: 3,  name: "Director Stratos", email: "director@stratos.ai",    password: "Director2024",role: "director" },
  { id: 4,  name: "Estefanía Valdes", email: "estefania@stratos.ai",   password: "Asesor2024",  role: "asesor" },
  { id: 5,  name: "Emmanuel Ortiz",   email: "emmanuel@stratos.ai",    password: "Asesor2024",  role: "asesor" },
  { id: 6,  name: "Araceli Oneto",    email: "araceli@stratos.ai",     password: "Asesor2024",  role: "asesor" },
  { id: 7,  name: "Ken Lugo Ríos",    email: "ken@stratos.ai",         password: "Asesor2024",  role: "asesor" },
  { id: 8,  name: "Cecilia Mendoza",  email: "cecilia@stratos.ai",     password: "Asesor2024",  role: "asesor" },
  { id: 9,  name: "Oscar Gálvez",     email: "oscar@stratos.ai",       password: "Asesor2024",  role: "asesor" },
];

export function seedDemoUser() {
  try {
    const existing = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    const merged = [...existing];
    for (const u of SEED_USERS) {
      if (!merged.some(e => e.email === u.email)) merged.push(u);
    }
    localStorage.setItem(USERS_KEY, JSON.stringify(merged));
  } catch {
    // Silent — localStorage puede no estar disponible (modo privado extremo)
  }
}

// ─── HELPERS INTERNOS ────────────────────────────────────────────────────────
function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
  } catch {
    return [];
  }
}

/** Quita el campo password antes de exponer el usuario al contexto */
function sanitize({ password: _, ...safe }) {
  return safe;
}

// ─── OPERACIONES DE AUTH ──────────────────────────────────────────────────────

/**
 * Inicia sesión con email y contraseña.
 * TODO Supabase: return await supabase.auth.signInWithPassword({ email, password })
 */
export async function signIn(email, password) {
  const users = getUsers();
  const found = users.find(u => u.email === email && u.password === password);

  if (!found) {
    return { data: null, error: "Credenciales incorrectas. Verifica tu email y contraseña." };
  }

  if (found.isActive === false) {
    return { data: null, error: "Esta cuenta está desactivada. Contacta a tu administrador." };
  }

  const safe = sanitize(found);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  return { data: safe, error: null };
}

/**
 * Registra un nuevo usuario.
 * TODO Supabase: return await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
 */
export async function signUp(name, email, password) {
  const users = getUsers();

  if (users.some(u => u.email === email)) {
    return { data: null, error: "Este email ya está registrado. ¿Olvidaste tu contraseña?" };
  }

  const newUser = { id: Date.now(), name, email, password, role: "asesor" };
  localStorage.setItem(USERS_KEY, JSON.stringify([...users, newUser]));

  const safe = sanitize(newUser);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  return { data: safe, error: null };
}

/**
 * Cierra la sesión actual.
 * TODO Supabase: await supabase.auth.signOut()
 */
export async function signOut() {
  localStorage.removeItem(STORAGE_KEY);
  return { error: null };
}

/**
 * Envía email de recuperación de contraseña.
 * TODO Supabase: return await supabase.auth.resetPasswordForEmail(email)
 */
export async function resetPassword(email) {
  const users = getUsers();
  const exists = users.some(u => u.email === email);

  // Por seguridad, siempre retornamos éxito (no revelar si el email existe)
  if (!exists) {
    return { data: { message: "Si el email existe, recibirás instrucciones." }, error: null };
  }

  // TODO: Enviar email real. Con Supabase esto es automático.
  console.info(`[Auth] Password reset simulado para: ${email}`);
  return { data: { message: "Se enviaron instrucciones a tu email." }, error: null };
}

/**
 * Lee la sesión activa desde el almacenamiento local.
 * TODO Supabase: return await supabase.auth.getSession()
 */
export function getStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ─── ADMIN: GESTIÓN DE USUARIOS ──────────────────────────────────────────────

/** Retorna todos los usuarios sin passwords */
export function adminGetAllUsers() {
  return getUsers().map(({ password: _, ...u }) => u);
}

/** Crea un usuario nuevo (admin only) */
export function adminCreateUser({ name, email, password, role }) {
  const users = getUsers();
  if (users.some(u => u.email === email)) {
    return { data: null, error: "Este email ya está registrado." };
  }
  const newUser = {
    id: Date.now(),
    name,
    email,
    password: password || "Stratos2024",
    role: role || "asesor",
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(USERS_KEY, JSON.stringify([...users, newUser]));
  const { password: _, ...safe } = newUser;
  return { data: safe, error: null };
}

/** Actualiza datos de un usuario */
export function adminUpdateUser(id, updates) {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return { data: null, error: "Usuario no encontrado." };
  const updated = { ...users[idx], ...updates };
  users[idx] = updated;
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  // Actualizar sesión activa si es el mismo usuario
  const session = getStoredSession();
  if (session?.id === id) {
    const { password: _, ...safe } = updated;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  }
  const { password: _, ...safe } = updated;
  return { data: safe, error: null };
}

/** Elimina un usuario (no puede eliminarse a sí mismo) */
export function adminDeleteUser(id, currentUserId) {
  if (id === currentUserId) return { error: "No puedes eliminar tu propia cuenta." };
  const users = getUsers();
  const filtered = users.filter(u => u.id !== id);
  if (filtered.length === users.length) return { error: "Usuario no encontrado." };
  localStorage.setItem(USERS_KEY, JSON.stringify(filtered));
  return { error: null };
}

/** Resetea la contraseña de un usuario (admin only) */
export function adminResetPassword(id, newPassword) {
  return adminUpdateUser(id, { password: newPassword });
}
