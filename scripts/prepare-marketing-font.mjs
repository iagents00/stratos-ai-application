import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARKETING_FONT } from './marketing-font-spec.mjs';

// Fontshare permits self-hosting on our own website, but its FFL prohibits
// redistributing font binaries through a public source repository. Fetch the
// original, pinned file before web development/build; never commit this asset.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINATION = resolve(ROOT, MARKETING_FONT.path);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

async function prepare() {
  try {
    const existing = await readFile(DESTINATION);
    if (hash(existing) === MARKETING_FONT.sha256) {
      console.log('Switzer: original verificado, listo para la web.');
      return;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let bytes;
  try {
    const response = await fetch(MARKETING_FONT.url, { signal: controller.signal, redirect: 'error', credentials: 'omit' });
    if (!response.ok) throw new Error(`Fontshare respondió HTTP ${response.status}.`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.subarray(0, 4).toString('ascii') !== 'wOF2' || hash(bytes) !== MARKETING_FONT.sha256) {
      throw new Error('El archivo de Fontshare no coincide con el original aprobado (SHA-256).');
    }
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Fontshare tardó más de 15 segundos. Reintenta con conexión a internet.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  await mkdir(dirname(DESTINATION), { recursive: true });
  const temporary = `${DESTINATION}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, bytes, { flag: 'wx' });
    await rename(temporary, DESTINATION);
  } finally {
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
  console.log(`Switzer: ${bytes.length.toLocaleString('es-MX')} bytes descargados y verificados para la web.`);
}

prepare().catch(error => {
  console.error(`No se pudo preparar la tipografía de marketing: ${error.message}`);
  process.exitCode = 1;
});
