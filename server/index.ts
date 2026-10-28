import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { api } from './app.ts';
import { pruneSessions } from './auth.ts';
import { DEMO_PASSWORD, DEMO_PLAYER_EMAIL, seedDemo } from './seed.ts';
import { DEMO_ORG_EMAIL, startSimulator } from './sim.ts';

const port = Number(process.env.PORT ?? 8787);
const app = new Hono();

app.route('/', api);

// In production the built web app (npm run build → dist/) is served from here too.
const indexFile = resolve('dist', 'index.html');
if (existsSync(indexFile)) {
  const indexHtml = readFileSync(indexFile, 'utf8');
  app.use(
    '*',
    serveStatic({
      root: './dist',
      onFound: (path, c) => {
        if (path.includes('/assets/')) c.header('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }),
  );
  // Client-side routes (/play, /org/boxes/3, …) all load the single-page app.
  app.get('*', (c) => c.html(indexHtml));
}

if (process.env.SEED_DEMO !== 'false' && (await seedDemo())) {
  console.log(`Seeded demo accounts → player: ${DEMO_PLAYER_EMAIL} · organisation: ${DEMO_ORG_EMAIL} · password: ${DEMO_PASSWORD}`);
}

startSimulator();
pruneSessions();
setInterval(pruneSessions, 6 * 3_600_000).unref();

serve({ fetch: app.fetch, port }, (info) => {
  const web = existsSync(indexFile) ? `http://localhost:${info.port}` : 'http://localhost:5173 (npm run dev)';
  console.log(`Kontho API listening on :${info.port} — open ${web}`);
});
