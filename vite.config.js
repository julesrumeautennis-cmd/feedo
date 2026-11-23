import { defineConfig, loadEnv } from 'vite';
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

export default defineConfig(({ mode }) => {
  function middleware(server) {
    server.middlewares.use('/api/training', async (req, res) => {
      const { handle } = await import('./api/training.js');
      const file = '.env.band.local';
      const keys = existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {};
      await handle(req, res, { ...loadEnv(mode, process.cwd(), ''), ...process.env, ...keys });
    });
  }
  return { plugins: [{ name: 'feedo-training-api', configureServer: middleware, configurePreviewServer: middleware }] };
});
