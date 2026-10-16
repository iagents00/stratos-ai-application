import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, lstatSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonicalJson, gitBlobHash, isApprovedGeneratedAsset, verifySourceTree } from '../scripts/check-vercel-production.mjs';
import { MARKETING_FONT } from '../scripts/marketing-font-spec.mjs';
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

test('acepta la serialización equivalente de Vercel y rechaza cambios reales de configuración', t => {
  const {root, tree} = fixture(t);
  const expected = {framework: 'vite', buildCommand: 'npm run build:vercel'};
  const config = tree.find(entry => entry.path === 'vercel.json');
  config.sha = gitBlobHash(Buffer.from(JSON.stringify(expected, null, 2)));
  config.canonicalJSON = JSON.stringify(canonicalJson(expected));
  writeFileSync(join(root, 'vercel.json'), JSON.stringify({buildCommand: expected.buildCommand, framework: expected.framework}));
  assert.doesNotThrow(() => verifySourceTree(root, tree));
  writeFileSync(join(root, 'vercel.json'), JSON.stringify({...expected, buildCommand: 'npm run old'}));
  assert.throws(() => verifySourceTree(root, tree), /Cambios sin integrar/);
});

const generatedFontPath = MARKETING_FONT.path;
function writeGeneratedFont(root, bytes = Buffer.from('wOF2altered font')) {
  mkdirSync(join(root, 'public/fonts/marketing'), { recursive: true });
  writeFileSync(join(root, generatedFontPath), bytes);
  return bytes;
}

test('la política acepta solo la ruta y el hash fijados de Switzer en un archivo regular', t => {
  const {root} = fixture(t);
  const stats = lstatSync(join(root, 'src/app.js'));
  assert.equal(Object.isFrozen(MARKETING_FONT), true);
  assert.equal(isApprovedGeneratedAsset(generatedFontPath, stats, MARKETING_FONT.sha256), true);
  assert.equal(isApprovedGeneratedAsset(generatedFontPath + '.tmp', stats, MARKETING_FONT.sha256), false);
  assert.equal(isApprovedGeneratedAsset('public/fonts/marketing/foreign.woff2', stats, MARKETING_FONT.sha256), false);
  assert.equal(isApprovedGeneratedAsset(generatedFontPath, stats, createHash('sha256').update('tampered font').digest('hex')), false);
});

test('la política rechaza symlinks y directorios incluso con el hash fijado', t => {
  const {root} = fixture(t);
  const link = join(root, 'font-link');
  symlinkSync(join(root, 'src/app.js'), link);
  assert.equal(isApprovedGeneratedAsset(generatedFontPath, lstatSync(link), MARKETING_FONT.sha256), false);
  assert.equal(isApprovedGeneratedAsset(generatedFontPath, lstatSync(join(root, 'src')), MARKETING_FONT.sha256), false);
});

test('rechaza una fuente generada con contenido distinto del original aprobado', t => {
  const {root, tree} = fixture(t);
  writeGeneratedFont(root);
  assert.throws(() => verifySourceTree(root, tree), /switzer-variable\.woff2/);
});

test('rechaza un enlace simbólico en la ruta de la fuente generada', t => {
  const {root, tree} = fixture(t);
  mkdirSync(join(root, 'public/fonts/marketing'), { recursive: true });
  symlinkSync(join(root, 'src/app.js'), join(root, generatedFontPath));
  assert.throws(() => verifySourceTree(root, tree), /switzer-variable\.woff2/);
});

test('rechaza enlaces simbólicos en directorios de la fuente generada', t => {
  const {root, tree} = fixture(t);
  mkdirSync(join(root, 'public'));
  mkdirSync(join(root, 'font-target/marketing'), { recursive: true });
  writeFileSync(join(root, 'font-target/marketing/switzer-variable.woff2'), 'wOF2altered font');
  symlinkSync(join(root, 'font-target'), join(root, 'public/fonts'), 'dir');
  assert.throws(() => verifySourceTree(root, tree), /public\/fonts/);
});

test('rechaza public como symlink aunque apunte a archivos oficiales intactos', t => {
  const {root, tree} = fixture(t);
  const bytes = Buffer.from('official public/known.txt\n');
  mkdirSync(join(root, 'public'));
  writeFileSync(join(root, 'public/known.txt'), bytes);
  tree.push({path: 'public/known.txt', type: 'blob', mode: '100644', sha: gitBlobHash(bytes)});
  assert.equal(verifySourceTree(root, tree), 9);
  renameSync(join(root, 'public'), join(root, 'public-target'));
  symlinkSync(join(root, 'public-target'), join(root, 'public'), 'dir');
  assert.throws(() => verifySourceTree(root, tree), /Directorio de fuente inseguro: public/);
});

test('la excepción de Switzer no permite archivos vecinos ajenos a main', t => {
  const {root, tree} = fixture(t);
  mkdirSync(join(root, 'public/fonts/marketing'), { recursive: true });
  writeFileSync(join(root, 'public/fonts/marketing/foreign.woff2'), 'unapproved font');
  assert.throws(() => verifySourceTree(root, tree), /foreign\.woff2/);
});

test('la excepción generada no sustituye la verificación Git de un archivo de main', t => {
  const {root, tree} = fixture(t);
  const bytes = writeGeneratedFont(root);
  tree.push({path: generatedFontPath, type: 'blob', mode: '100644', sha: gitBlobHash(bytes)});
  assert.equal(verifySourceTree(root, tree), 9);
  writeFileSync(join(root, generatedFontPath), 'different tracked font');
  assert.throws(() => verifySourceTree(root, tree), /Cambios sin integrar/);
});
