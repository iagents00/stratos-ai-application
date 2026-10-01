import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkProjectBoundary } from './check-project-boundary.mjs';

const repository = 'iagents00/stratos-ai-application';
const sourceDirectories = ['src', 'public', 'api', 'server', 'scripts', 'tools', 'assets', 'tests', 'ops'];
const sourceFiles = ['package.json', 'package-lock.json', 'index.html', 'vite.config.js', 'vercel.json', 'project-identity.json', 'eslint.config.js'];
const isSource = path => sourceFiles.includes(path) || sourceDirectories.some(dir => path.startsWith(dir + '/'));
export function gitBlobHash(bytes) {
  return createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
}
export function verifySourceTree(root, tree) {
  if (!Array.isArray(tree)) throw new Error('GitHub no devolvió el árbol de fuente.');
  const expected = new Map(tree.filter(entry => entry.type === 'blob' && isSource(entry.path)).map(entry => [entry.path, entry]));
  for (const file of sourceFiles) if (!expected.has(file)) throw new Error(`Fuente incompleta: ${file}`);
  for (const [path, entry] of expected) {
    const local = resolve(root, path);
    if (!local.startsWith(resolve(root) + '/') || entry.mode === '120000' || !existsSync(local) || !lstatSync(local).isFile()) throw new Error(`Archivo de fuente ausente o inseguro: ${path}`);
    if (gitBlobHash(readFileSync(local)) !== entry.sha) throw new Error(`Cambios sin integrar en main: ${path}`);
  }
  const walk = directory => {
    if (!existsSync(resolve(root, directory))) return;
    for (const entry of readdirSync(resolve(root, directory), { withFileTypes: true })) {
      if (entry.name === '.DS_Store') continue;
      const path = directory + '/' + entry.name;
      if (entry.isDirectory()) walk(path);
      else if (!expected.has(path)) throw new Error(`Archivo ajeno a main en la fuente: ${path}`);
    }
  };
  sourceDirectories.forEach(walk);
  return expected.size;
}
async function github(path) {
  const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'stratos-production-source' },
    signal: AbortSignal.timeout(20000), cache: 'no-store',
  });
  if (!response.ok) throw new Error(`No se puede verificar la fuente oficial de GitHub (HTTP ${response.status}).`);
  return response.json();
}
export async function checkVercelProduction(root = process.cwd(), env = process.env) {
  checkProjectBoundary(root, env);
  if (env.VERCEL_ENV !== 'production') { console.log('Vista previa: producción conserva su versión aprobada.'); return; }
  if (env.VERCEL_GIT_COMMIT_REF !== 'main' || !/^[a-f0-9]{40}$/.test(env.VERCEL_GIT_COMMIT_SHA || '')) throw new Error('Producción requiere un commit identificado de main.');
  const branch = await github('branches/main');
  if (branch.commit?.sha !== env.VERCEL_GIT_COMMIT_SHA) throw new Error('Publicación antigua: el commit construido ya no es el main vigente.');
  const tree = await github(`git/trees/${branch.commit.commit.tree.sha}?recursive=1`);
  if (tree.truncated) throw new Error('No se puede verificar un árbol truncado.');
  const count = verifySourceTree(root, tree.tree);
  console.log(`Fuente oficial de producción: ${branch.commit.sha} (${count} archivos comprobados).`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await checkVercelProduction(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
