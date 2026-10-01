import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Explicit allowlist: never collect private credentials, sessions, PHI or .env.
const files = [
  'project-identity.json', 'api/dental-huli.js', 'server/clinical-auth.mjs',
  'server/clinical-request.mjs', 'server/dental-huli.mjs', 'server/dental-security.mjs',
  'tests/clinical-auth.test.mjs', 'tests/clinical-request.test.mjs', 'tests/dental-huli-server.test.mjs',
  'scripts/audit-dental-live.mjs', 'scripts/build-dental-audit-pack.mjs',
  'docs/CLINICA_DENTAL_AUDITORIA_Y_USO_2026-09-27.md', 'docs/dental-live-audit-2026-09-27.json',
  'docs/auditoria-clinica/README.md', 'docs/auditoria-clinica/registro-de-brechas.csv',
  'docs/auditoria-clinica/procedimientos.md', 'docs/auditoria-clinica/datos-y-documentos-pendientes.md',
  'docs/auditoria-clinica/pruebas-locales.txt', 'docs/auditoria-clinica/verificacion-logs.json',
  'docs/auditoria-clinica/verificacion-despliegue.json',
  'docs/auditoria-clinica/primera-prueba-produccion.json',
];
const evidence = files.map(file => {
  const content = fs.readFileSync(file);
  return { path: file, bytes: content.byteLength, sha256: createHash('sha256').update(content).digest('hex') };
});
const manifest = {
  generatedAt: new Date().toISOString(), gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  workingTreeDirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  scope: 'Technical readiness evidence for the administrative Huli pilot; not regulatory certification',
  signed: false, immutableCustodyVerified: false, evidence,
};
fs.writeFileSync('docs/auditoria-clinica/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ files: evidence.length, signed: false, workingTreeDirty: manifest.workingTreeDirty }));
