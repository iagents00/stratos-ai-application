import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { patchAgendaRoute } from './copilot-agenda-guard.mjs';

const id = '8ZasBukTkSx26m2A';
const base = 'https://personal-n8n.suwsiw.easypanel.host/api/v1';
const args = process.argv.slice(2);
const backupArg = args.indexOf('--backup-dir');
const apply = args.includes('--apply');
if (!process.env.N8N_API_KEY) throw new Error('N8N_API_KEY required; never store it in the repository.');
if (apply && (backupArg < 0 || !args[backupArg + 1])) throw new Error('An external private backup directory is required.');
async function api(path, method = 'GET', body) {
  const response = await fetch(base + path, {
    method, signal: AbortSignal.timeout(30000),
    headers: { 'X-N8N-API-KEY': process.env.N8N_API_KEY, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`n8n ${method} ${path}: HTTP ${response.status}`);
  return response.json();
}
const before = await api(`/workflows/${id}`);
if (!before.active || before.versionId !== before.activeVersionId) throw new Error('Inspect inactive workflow or unpublished changes first.');
const nodes = structuredClone(before.nodes);
const target = nodes.filter(n => n.name === 'Parse Intérprete');
if (target.length !== 1) throw new Error('Expected one interpreter node.');
target[0].parameters.jsCode = patchAgendaRoute(target[0].parameters.jsCode);
const changed = JSON.stringify(nodes) !== JSON.stringify(before.nodes);
console.log(JSON.stringify({ id, apply, changed, previousVersion: before.versionId }));
if (!apply || !changed) process.exit(0);
const directory = resolve(args[backupArg + 1]);
if (!directory.startsWith('/opt/backups/')) throw new Error('Use a protected /opt/backups directory on the operator VPS.');
mkdirSync(directory, { recursive: true, mode: 0o700 });
const backup = resolve(directory, `${id}-${before.versionId}.json`);
writeFileSync(backup, JSON.stringify(before), { mode: 0o600, flag: 'wx' });
const current = await api(`/workflows/${id}`);
if (current.versionId !== before.versionId || current.activeVersionId !== before.activeVersionId) throw new Error('Concurrent workflow update; stopped.');
const updated = await api(`/workflows/${id}`, 'PUT', {
  name: before.name, nodes, connections: before.connections, settings: before.settings,
});
let after = await api(`/workflows/${id}`);
if (after.activeVersionId !== updated.versionId) {
  await api(`/workflows/${id}/activate`, 'POST', { versionId: updated.versionId });
  after = await api(`/workflows/${id}`);
}
if (!after.active || after.versionId !== updated.versionId || after.activeVersionId !== after.versionId)
  throw new Error('Publication not confirmed; inspect workflow history.');
if (JSON.stringify(after.connections) !== JSON.stringify(before.connections)) throw new Error('Connections changed unexpectedly.');
if (JSON.stringify(after.nodes) !== JSON.stringify(nodes)) throw new Error('Saved nodes differ from the scoped patch.');
const savedCode = after.nodes.find(n => n.name === 'Parse Intérprete')?.parameters.jsCode;
if (savedCode !== target[0].parameters.jsCode) throw new Error('Saved code differs from tested code.');
console.log(JSON.stringify({ id, publishedVersion: after.activeVersionId, backup, nodeCount: after.nodes.length }));
