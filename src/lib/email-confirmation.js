/** Consume only email-change callbacks, without installing a URL-supplied session. */
export function readEmailConfirmation(location, history) {
  const fragment = new URLSearchParams(location.hash.slice(1));
  if (fragment.get('type') !== 'email_change') return null;
  const token = fragment.get('access_token');
  history.replaceState(null, '', location.pathname + location.search);
  return { token };
}
