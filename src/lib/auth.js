/**
 * lib/auth.js — Autenticación con localStorage (prototipo)
 * Cuando se active Supabase, solo cambia este archivo.
 */

const STORAGE_KEY = "stratos_user";
const USERS_KEY   = "stratos_users";

const SEED_USERS = [
  { id: 1,  name: "Usuario Demo",     email: "demo@stratos.ai",      password: "Demo2024",    role: "admin" },
  { id: 2,  name: "Ivan Rodriguez",   email: "ivan@stratos.ai",      password: "Admin2024",   role: "super_admin" },
  { id: 3,  name: "Director Stratos", email: "director@stratos.ai",  password: "Director2024",role: "director" },
  { id: 4,  name: "Estefanía Valdes", email: "estefania@stratos.ai", password: "Asesor2024",  role: "asesor" },
  { id: 5,  name: "Emmanuel Ortiz",   email: "emmanuel@stratos.ai",  password: "Asesor2024",  role: "asesor" },
  { id: 6,  name: "Araceli Oneto",    email: "araceli@stratos.ai",   password: "Asesor2024",  role: "asesor" },
  { id: 7,  name: "Ken Lugo Ríos",    email: "ken@stratos.ai",       password: "Asesor2024",  role: "asesor" },
  { id: 8,  name: "Cecilia Mendoza",  email: "cecilia@stratos.ai",   password: "Asesor2024",  role: "asesor" },
  { id: 9,  name: "Oscar Gálvez",     email: "oscar@stratos.ai",     password: "Asesor2024",  role: "asesor" },
];

export function seedDemoUser() {
  try {
    // Siempre re-siembra para asegurarse que los usuarios tienen contraseña
    const existing = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    const merged = [...existing];
    for (const u of SEED_USERS) {
      const idx = merged.findIndex(e => e.email === u.email);
      if (idx === -1) {
        merged.push(u);
      } else if (!merged[idx].password) {
        // Usuario sin contraseña (sesión Supabase vieja) — reemplazar
        merged[idx] = { ...merged[idx], ...u };
      }
    }
    localStorage.setItem(USERS_KEY, JSON.stringify(merged));
  } catch { /* silent */ }
}

function getUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); } catch { return []; }
}

function sanitize({ password: _, ...safe }) { return safe; }

export async function signIn(email, password) {
  const users = getUsers();
  const found = users.find(u => u.email === email && u.password === password);
  if (!found) return { data: null, error: "Credenciales incorrectas. Verifica tu email y contraseña." };
  if (found.isActive === false) return { data: null, error: "Cuenta desactivada. Contacta a tu administrador." };
  const safe = sanitize(found);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  return { data: safe, error: null };
}

export async function signUp(name, email, password) {
  const users = getUsers();
  if (users.some(u => u.email === email)) return { data: null, error: "Este email ya está registrado." };
  const newUser = { id: Date.now(), name, email, password, role: "asesor", isActive: true };
  localStorage.setItem(USERS_KEY, JSON.stringify([...users, newUser]));
  const safe = sanitize(newUser);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  return { data: safe, error: null };
}

export async function signOut() {
  localStorage.removeItem(STORAGE_KEY);
  return { error: null };
}

export async function resetPassword(email) {
  return { data: { message: "Si el email existe, recibirás instrucciones." }, error: null };
}

export function getStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function adminGetAllUsers() { return getUsers().map(({ password: _, ...u }) => u); }
export function adminCreateUser({ name, email, password, role }) {
  const users = getUsers();
  if (users.some(u => u.email === email)) return { data: null, error: "Email ya registrado." };
  const newUser = { id: Date.now(), name, email, password: password || "Stratos2024", role: role || "asesor", isActive: true, createdAt: new Date().toISOString() };
  localStorage.setItem(USERS_KEY, JSON.stringify([...users, newUser]));
  const { password: _, ...safe } = newUser;
  return { data: safe, error: null };
}
export function adminUpdateUser(id, updates) {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return { data: null, error: "Usuario no encontrado." };
  users[idx] = { ...users[idx], ...updates };
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  const { password: _, ...safe } = users[idx];
  return { data: safe, error: null };
}
export function adminDeleteUser(id, currentUserId) {
  if (id === currentUserId) return { error: "No puedes eliminar tu propia cuenta." };
  const users = getUsers();
  localStorage.setItem(USERS_KEY, JSON.stringify(users.filter(u => u.id !== id)));
  return { error: null };
}
export function adminResetPassword(id, newPassword) { return adminUpdateUser(id, { password: newPassword }); }
