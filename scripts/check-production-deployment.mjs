import { createHash } from 'node:crypto';

const DEFAULT_PRODUCTION_URL = 'https://app.stratoscapitalgroup.com/';
const TIMEOUT_MS = 15_000;

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (name === '--help') {
      console.log('Usage: node scripts/check-production-deployment.mjs [--production-url HTTPS_URL] [--reference-url HTTPS_URL] [--repository OWNER/REPO]');
      process.exit(0);
    }
    if (!['--production-url', '--reference-url', '--repository'].includes(name) || !argv[index + 1]) {
      throw new Error('Argumento inválido: ' + name);
    }
    options[name.slice(2)] = argv[index + 1];
    index += 1;
  }
  return options;
}

function baseUrl(raw, label) {
  const url = new URL(raw);
  if (url.protocol !== 'https:') {
    throw new Error(label + ' debe usar HTTPS.');
  }
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  return url;
}

function sha256(body) {
  return createHash('sha256').update(body).digest('hex');
}

async function requestText(url, label, headers = {}) {
  let response;
  try {
    response = await fetch(url, {
      headers: { 'cache-control': 'no-cache', ...headers },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(label + ': no se pudo consultar ' + url + ' (' + error.message + ')');
  }
  if (!response.ok) {
    throw new Error(label + ': HTTP ' + response.status + ' al consultar ' + url);
  }
  return response.text();
}

async function githubJson(url, token) {
  const body = await requestText(url, 'GitHub API', {
    accept: 'application/vnd.github+json',
    authorization: 'Bearer ' + token,
    'user-agent': 'stratos-production-deployment-guard',
    'x-github-api-version': '2022-11-28',
  });
  try {
    return JSON.parse(body);
  } catch {
    throw new Error('GitHub API devolvió una respuesta que no es JSON: ' + url);
  }
}

async function latestSuccessfulProductionDeployment(repository, token) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error('GITHUB_REPOSITORY debe tener formato OWNER/REPO.');
  }
  if (!token) {
    throw new Error('Falta GITHUB_TOKEN para consultar los deployments de GitHub.');
  }
  const endpoint = 'https://api.github.com/repos/' + repository + '/deployments?environment=Production&per_page=100';
  const deployments = await githubJson(endpoint, token);
  if (!Array.isArray(deployments)) {
    throw new Error('GitHub API no devolvió una lista de deployments.');
  }
  for (const deployment of deployments) {
    if (deployment.environment !== 'Production') continue;
    const statuses = await githubJson(deployment.statuses_url + '?per_page=100', token);
    if (!Array.isArray(statuses)) continue;
    const success = statuses.find((status) => status.state === 'success');
    const rawUrl = success?.environment_url || success?.target_url;
    if (!rawUrl) continue;
    return {
      url: baseUrl(rawUrl, 'La URL del deployment'),
      description: 'deployment ' + deployment.id + ' (' + String(deployment.sha).slice(0, 7) + ')',
    };
  }
  throw new Error('No se encontró un deployment Production exitoso con URL verificable en los últimos 100.');
}

async function fingerprint(url) {
  const cacheBust = '?deployment-check=' + Date.now();
  const [html, serviceWorker] = await Promise.all([
    requestText(new URL('/' + cacheBust, url), 'index.html'),
    requestText(new URL('/sw.js' + cacheBust, url), 'sw.js'),
  ]);
  const assetPaths = [...new Set(
    [...html.matchAll(/\/assets\/index-[A-Za-z0-9_-]+\.js\b/g)].map((match) => match[0]),
  )];
  if (assetPaths.length !== 1) {
    throw new Error(url + ': index.html debe referenciar exactamente un /assets/index-*.js; encontrados ' + assetPaths.length + '.');
  }
  const versionMatch = serviceWorker.match(/^\s*const\s+CACHE_VERSION\s*=\s*['"]([^'"]+)['"]/m);
  if (!versionMatch) {
    throw new Error(url + ': sw.js no declara CACHE_VERSION.');
  }
  const assetBody = await requestText(new URL(assetPaths[0], url), 'Asset principal');
  return {
    asset: assetPaths[0],
    assetHash: sha256(assetBody),
    swVersion: versionMatch[1],
    swHash: sha256(serviceWorker),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const production = baseUrl(options['production-url'] || process.env.STRATOS_PRODUCTION_URL || DEFAULT_PRODUCTION_URL, 'El dominio de producción');
  const reference = options['reference-url']
    ? { url: baseUrl(options['reference-url'], 'La URL de referencia'), description: 'URL de referencia explícita' }
    : await latestSuccessfulProductionDeployment(
      options.repository || process.env.GITHUB_REPOSITORY || '',
      process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '',
    );

  const [actual, expected] = await Promise.all([
    fingerprint(production),
    fingerprint(reference.url),
  ]);
  console.log('Producción: ' + production);
  console.log('Referencia: ' + reference.url + ' — ' + reference.description);
  console.log('index.js: ' + actual.asset + ' | esperado: ' + expected.asset);
  console.log('sw.js: ' + actual.swVersion + ' | esperado: ' + expected.swVersion);

  const differences = [];
  if (actual.asset !== expected.asset) differences.push('nombre de index.js');
  if (actual.assetHash !== expected.assetHash) differences.push('contenido de index.js');
  if (actual.swVersion !== expected.swVersion) differences.push('CACHE_VERSION de sw.js');
  if (actual.swHash !== expected.swHash) differences.push('contenido de sw.js');
  if (differences.length) {
    throw new Error('Producción no coincide con el último deployment Production exitoso: ' + differences.join(', ') + '. Revisar el alias de Vercel antes de desplegar o revertir.');
  }
  console.log('OK: producción coincide con el último deployment Production exitoso.');
}

main().catch((error) => {
  console.error('::error::' + error.message);
  process.exitCode = 1;
});
