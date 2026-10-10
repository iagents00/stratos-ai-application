// Native WebViews and local previews must share links on the public website.
export function portfolioOrigin(origin) {
  try {
    const url = new URL(origin);
    if (url.protocol === 'https:' && ['stratoscapitalgroup.com', 'app.stratoscapitalgroup.com', 'www.stratoscapitalgroup.com', 'getstratosai.com', 'app.getstratosai.com', 'www.getstratosai.com'].includes(url.hostname)) return url.origin;
  } catch { /* Capacitor may expose an opaque origin. */ }
  return 'https://stratoscapitalgroup.com';
}
