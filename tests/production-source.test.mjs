import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gitBlobHash, verifySourceTree } from '../scripts/check-vercel-production.mjs';
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'stratos-source-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'src'));
  const paths = ['package.json', 'package-lock.json', 'index.html', 'vite.config.js', 'vercel.json', 'project-identity.json', 'eslint.config.js', 'src/app.js'];
  const tree = paths.map(path => {
    const body = Buffer.from(`official ${path}\n`);
    writeFileSync(join(root, path), body);
    return { path, type: 'blob', mode: '100644', sha: gitBlobHash(body) };
  });
  return {root, tree};
}
test('acepta una copia completa de la fuente oficial sin necesitar .git', t => {
  const {root, tree} = fixture(t);
  assert.equal(verifySourceTree(root, tree), 8);
});
test('bloquea cambios locales que conservan el SHA de main en sus metadatos', t => {
  const {root, tree} = fixture(t);
  writeFileSync(join(root, 'src/app.js'), 'old or dirty app');
  assert.throws(() => verifySourceTree(root, tree), /Cambios sin integrar/);
});
test('bloquea código adicional y archivos oficiales ausentes', t => {
  const {root, tree} = fixture(t);
  writeFileSync(join(root, 'src/foreign.js'), 'untracked code');
  assert.throws(() => verifySourceTree(root, tree), /Archivo ajeno/);
  rmSync(join(root, 'src/foreign.js'));
  rmSync(join(root, 'src/app.js'));
  assert.throws(() => verifySourceTree(root, tree), /ausente/);
});
test('rechaza un árbol incompleto y enlaces simbólicos en entradas de producción', t => {
  const {root, tree} = fixture(t);
  assert.throws(() => verifySourceTree(root, []), /Fuente incompleta/);
  tree.at(-1).mode = '120000';
  assert.throws(() => verifySourceTree(root, tree), /inseguro/);
});
