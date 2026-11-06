// The server returns a rolling window. Preserve local turns awaiting logging;
// while reading, also retain older loaded rows that fall outside that window.
export function mergeCopilotHistory(previous, incoming, { merge = false, preserveEarlier = false } = {}) {
  if (!merge) return incoming;
  const time = message => new Date(message.occurred_at || 0).getTime() || 0;
  const key = message => `${message.role}|${(message.content || '').trim()}`;
  const server = incoming.map(message => ({ id: message.id, key: key(message), time: time(message) }));
  const oldest = incoming.length ? Math.min(...incoming.map(time)) : 0;
  const retained = previous.filter(message => {
    if (server.some(row => row.id === message.id)) return false;
    const local = String(message.id || '').startsWith('tmp-') || String(message.id || '').startsWith('ai-');
    if (local) return !server.some(row => row.key === key(message) && Math.abs(row.time - time(message)) < 90000);
    return preserveEarlier && time(message) < oldest;
  });
  if (!retained.length) return incoming;
  return [...incoming, ...retained].map((message, index) => ({ message, index }))
    .sort((a, b) => (time(a.message) - time(b.message)) || (a.index - b.index))
    .map(row => row.message);
}
