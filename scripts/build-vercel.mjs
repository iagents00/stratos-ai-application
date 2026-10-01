import { execFileSync } from 'node:child_process';
import { checkVercelProduction } from './check-vercel-production.mjs';
await checkVercelProduction();
const run = script => execFileSync('npm', ['run', script], { stdio: 'inherit' });
if (process.env.VERCEL_ENV === 'production') {
  for (const script of ['check:runtime', 'test', 'probar-rails', 'test:rails-db']) run(script);
  for (const script of ['scripts/check-tenant-modules.mjs', 'scripts/verificar-tenant-route.mjs']) execFileSync('node', [script], { stdio: 'inherit' });
}
run('build');
// Rechaza builds que quedaron detrás de main mientras compilaban.
await checkVercelProduction();
