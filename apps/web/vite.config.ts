import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export default defineConfig(() => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  // Read server settings without Vite loadEnv's NODE_ENV side effects: the root .env
  // uses development for the API, but production builds must retain production React.
  const envFile = path.join(root, '.env');
  const env = { ...(existsSync(envFile) ? parse(readFileSync(envFile)) : {}), ...process.env };
  const target = `http://127.0.0.1:${env.PORT || '3001'}`;
  const https =
    env.LOCAL_HTTPS === '1'
      ? {
          cert: readFileSync(path.resolve(root, env.LOCAL_TLS_CERT || '.local/certs/lan.pem')),
          key: readFileSync(path.resolve(root, env.LOCAL_TLS_KEY || '.local/certs/lan-key.pem')),
        }
      : undefined;
  return {
    plugins: [react()],
    server: {
      host: env.DEV_LAN === '1' ? '0.0.0.0' : '127.0.0.1',
      https,
      port: 5173,
      strictPort: true,
      // Let the browser supply its current LAN hostname; localhost would break phones.
      hmr: { clientPort: 5173, timeout: 30000, overlay: true },
      watch: {
        ignored: ['**/media/**', '**/.local/**', '**/dist/**'],
        usePolling: env.DEV_WATCH_POLL === '1',
        ...(env.DEV_WATCH_POLL === '1' ? { interval: 300 } : {}),
      },
      proxy: {
        '/api': target,
        '/socket.io': { target, ws: true },
      },
    },
    build: { outDir: '../../dist/web', emptyOutDir: true },
  };
});
