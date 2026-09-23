/** A failed profile lookup is not evidence that Copilot is disabled. */
export async function loadCopilotProfile(client, userId, timeoutMs = 8000) {
  const controller = new AbortController();
  let timer;
  try {
    const request = client.from('profiles')
      .select('telegram_chat_id, role, is_marketing_admin, organization_id')
      .eq('id', userId)
      .abortSignal(controller.signal)
      .single();
    const result = await Promise.race([
      request,
      new Promise((resolve) => {
        timer = setTimeout(() => {
          controller.abort();
          resolve({ error: { message: 'profile timeout' } });
        }, timeoutMs);
      }),
    ]);
    if (result.error || !result.data) return { profile: null, error: 'profile_unavailable' };
    if (!result.data.telegram_chat_id) return { profile: null, error: 'not_paired' };
    return { profile: result.data, error: null };
  } catch {
    return { profile: null, error: 'profile_unavailable' };
  } finally {
    clearTimeout(timer);
  }
}
