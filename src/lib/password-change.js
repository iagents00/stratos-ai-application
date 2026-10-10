/** Change only the authenticated user's password; never trust a cached UI identity. */
export async function changeOwnPassword(client, password, { timeoutMs = 15000 } = {}) {
  if (typeof password !== 'string' || password.length < 8) {
    return { ok: false, error: 'La contraseña debe tener al menos 8 caracteres.' };
  }
  const bounded = async (operation) => {
    let timer;
    try {
      return await Promise.race([
        operation,
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), timeoutMs); }),
      ]);
    } finally { clearTimeout(timer); }
  };
  try {
    let session;
    try { session = (await bounded(client.auth.getSession())).data?.session; } catch { /* refresh below */ }
    if (!session || !session.expires_at || session.expires_at * 1000 <= Date.now() + 30000) {
      const refreshed = await bounded(client.auth.refreshSession());
      session = refreshed.error ? null : refreshed.data?.session;
    }
    if (!session) return { ok: false, error: 'Tu sesión expiró. Vuelve a iniciar sesión y cambia tu contraseña de nuevo.' };
    const { data, error } = await bounded(client.auth.updateUser({ password }));
    if (error) {
      const message = error.code === 'same_password' ? 'Elige una contraseña distinta de la actual.'
        : error.code === 'weak_password' ? 'La contraseña no cumple los requisitos de seguridad. Elige una más segura.'
        : 'No se pudo actualizar la contraseña. Intenta de nuevo o vuelve a iniciar sesión.';
      return { ok: false, error: message };
    }
    if (!data?.user?.id || data.user.id !== session.user?.id) {
      return { ok: false, error: 'No se pudo confirmar el cambio. Intenta de nuevo.' };
    }
    return { ok: true, user: data.user };
  } catch {
    return { ok: false, error: 'No se pudo confirmar el cambio por un problema de conexión. Comprueba el acceso antes de intentarlo de nuevo.' };
  }
}
