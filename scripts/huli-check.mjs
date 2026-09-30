import fs from 'node:fs/promises';
import { HuliClient } from '../supabase/functions/_shared/huli.mjs';
// Read-only live check. Never prints API keys, JWTs, or patient information.
try {
  const config = JSON.parse(await fs.readFile(new URL('../.huli-credentials.local', import.meta.url), 'utf8'));
  const status = await new HuliClient(config).status();
  console.log(JSON.stringify({ connected: true, ...status }, null, 2));
} catch {
  console.error('No se pudo verificar Huli. Revisa el archivo local de credenciales y los permisos de la cuenta.');
  process.exitCode = 1;
}
