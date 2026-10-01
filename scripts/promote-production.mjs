import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { checkProductionSource } from './check-production-source.mjs';

try {
  const commit = checkProductionSource();
  const identity = JSON.parse(readFileSync('project-identity.json', 'utf8'));
  const url = new URL(process.argv[2]);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.vercel.app')) throw new Error('Proporciona la URL HTTPS del deployment de Vercel.');
  const deployment = JSON.parse(execFileSync('vercel', ['api', `/v13/deployments/${url.hostname}?teamId=${identity.vercelOrgId}`, '--raw'], { encoding: 'utf8' }));
  const sha = deployment.gitSource?.sha || deployment.meta?.githubCommitSha;
  if (deployment.projectId !== identity.vercelProjectId || deployment.readyState !== 'READY' || sha !== commit || deployment.meta?.gitDirty === '1') {
    throw new Error('Deployment incorrecto, antiguo, sin terminar o con cambios sin registrar.');
  }
  const response = await fetch(new URL('/release.json', url), { signal: AbortSignal.timeout(15000), cache: 'no-store' });
  if (!response.ok) throw new Error(`No se puede verificar release.json (HTTP ${response.status}).`);
  const release = await response.json();
  if (release.commit !== commit || release.projectId !== identity.vercelProjectId || release.dirty === true) throw new Error('La identidad o fuente del sitio construido no coincide con main.');
  execFileSync('vercel', ['promote', url.href, '--yes'], { stdio: 'inherit' });
  console.log(`Dominios promovidos a ${commit}. Ejecuta check-production-deployment.mjs para verificar.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
