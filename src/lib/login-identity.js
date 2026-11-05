/** Short Stratos usernames use the same registered domain as full email logins. */
export function normalizeLoginIdentity(value) {
  const identity = String(value || '').trim().toLowerCase();
  return identity && !identity.includes('@') && /^[a-z0-9._-]+$/.test(identity)
    ? identity + '@stratoscapitalgroup.com'
    : identity;
}
