import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { SOLO_WEB } from './vite.config.js';

const replacements = new Map([
  ['src/contexts/AuthContext', 'AuthContext.jsx'],
  ['src/contexts/ClientContext', 'ClientContext.jsx'],
  ['src/lib/supabase', 'backend.js'],
  ['src/lib/native', 'native.js'],
]);
export default defineConfig({
  base: '/guest/',
  plugins: [react(), {
    name: 'guest-only-data-boundary', enforce: 'pre',
    async resolveId(source, importer) {
      if (!importer || !source.startsWith('.')) return null;
      if (SOLO_WEB.has(source) || source === '../landing/LoginScreen.jsx') return fileURLToPath(new URL('./src/pagina-solo-web.jsx', import.meta.url));
      const resolved = await this.resolve(source, importer, { skipSelf: true });
      const path = resolved?.id.replaceAll('\\', '/').replace(/\.(?:js|jsx)$/, '');
      for (const [suffix, replacement] of replacements) {
        if (path?.endsWith(`/${suffix}`)) return fileURLToPath(new URL(`./src/guest/${replacement}`, import.meta.url));
      }
      return null;
    },
    generateBundle() {
      for (const id of this.getModuleIds()) {
        const path = id.replaceAll('\\', '/');
        if (/\/src\/(?:contexts\/(?:AuthContext|ClientContext)|lib\/(?:supabase|native))\.(?:js|jsx)$/.test(path) || path.includes('/node_modules/@supabase/')) {
          this.error(`Guest build contains a production capability: ${path}`);
        }
      }
    },
  }],
  build: { outDir: 'dist-app/guest', emptyOutDir: true, copyPublicDir: false, rollupOptions: { input: fileURLToPath(new URL('./guest.html', import.meta.url)) } },
});
