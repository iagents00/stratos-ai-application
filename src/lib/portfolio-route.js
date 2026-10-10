// Shared by the application router, public viewer and metadata endpoint.
export function portfolioCode(pathname) {
  return String(pathname || '').match(/^\/p\/([A-Za-z0-9_-]{1,64})\/?$/)?.[1] || null;
}
export function isPortfolioPath(pathname) {
  return pathname === '/p' || pathname === '/p/' || portfolioCode(pathname) !== null;
}
