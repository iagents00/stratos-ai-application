import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { checkProjectBoundary } from './check-project-boundary.mjs';

export function checkProductionSource(root = process.cwd()) {
  checkProjectBoundary(root);
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const expectedRoot = '/Users/ivanrodriguezruelas/stratos-ai-application';
  if (realpathSync(root) !== expectedRoot) throw new Error('Publica desde la carpeta principal de Stratos indicada en AGENTS.md.');
  if (git('status', '--porcelain', '--untracked-files=normal')) throw new Error('Registra todos los cambios antes de publicar.');
  const remote = git('remote', 'get-url', 'origin');
  if (!/github\.com[:/]iagents00\/stratos-ai-application(?:\.git)?$/.test(remote)) throw new Error('Repositorio de publicación incorrecto.');
  git('fetch', 'origin', 'main');
  const commit = git('rev-parse', 'HEAD');
  if (commit !== git('rev-parse', 'origin/main')) throw new Error('La copia local no coincide con main reciente. Integra el PR primero.');
  const checks = JSON.parse(execFileSync('gh', ['api', `repos/iagents00/stratos-ai-application/commits/${commit}/check-runs`], { encoding: 'utf8' }));
  const gate = checks.check_runs.find(check => check.name === 'Validar Stratos');
  if (gate?.conclusion !== 'success') throw new Error('main debe aprobar Validar Stratos antes de publicar.');
  console.log(`Fuente de producción verificada: ${commit}`);
  return commit;
}

if (process.argv[1]?.endsWith('/check-production-source.mjs')) {
  try { checkProductionSource(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
