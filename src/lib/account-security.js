/** Bound network waits without treating an uncertain write as success. */
export async function boundedAccountOperation(operation, timeoutMs = 15000) {
  let timer;
  try { return await Promise.race([operation, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), timeoutMs); })]); }
  finally { clearTimeout(timer); }
}
export async function requestEmailChange(client, email) {
  const clean = String(email || '').trim().toLowerCase();
  if (clean.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return { ok: false, error: 'Escribe un correo válido.' };
  try {
    const current = await boundedAccountOperation(client.auth.getUser());
    if (current.error || !current.data?.user?.id) return { ok: false, error: 'Tu sesión expiró. Inicia sesión de nuevo.' };
    if (current.data.user.email?.toLowerCase() === clean) return { ok: false, error: 'Este ya es tu correo de acceso.' };
    const result = await boundedAccountOperation(client.auth.updateUser({ email: clean }));
    if (result.error) return { ok: false, error: result.error.status === 429 ? 'Espera unos minutos antes de solicitar otro cambio.' : 'No se pudo solicitar el cambio. Comprueba el correo e inténtalo de nuevo.' };
    if (result.data?.user?.id !== current.data.user.id) return { ok: false, error: 'No se pudo confirmar la solicitud. Revisa tu cuenta antes de repetirla.' };
    return { ok: true, pending: result.data.user.email?.toLowerCase() !== clean, email: clean };
  } catch { return { ok: false, error: 'No se pudo confirmar el cambio por un problema de conexión. Revisa tus correos antes de repetirlo.' }; }
}
