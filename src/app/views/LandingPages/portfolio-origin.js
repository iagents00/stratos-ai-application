// Native WebViews and local previews must share links on the public website.
export function portfolioOrigin(origin) {
  try {
    const url = new URL(origin);
    if (url.protocol === 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return url.origin;
  } catch { /* Capacitor may expose an opaque origin. */ }
  return 'https://stratoscapitalgroup.com';
}
