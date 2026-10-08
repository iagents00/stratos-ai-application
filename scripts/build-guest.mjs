import { build } from 'vite';
import { copyFileSync } from 'node:fs';
await build({ configFile: 'vite.guest.config.js' });
copyFileSync('dist-app/guest/guest.html', 'dist-app/guest.html');
