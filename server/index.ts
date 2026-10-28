import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { DEMO_EMAIL, api } from './app.ts';
import { hashPassword, pruneSessions } from './auth.ts';
import { db } from './db.ts';
import { seedSampleData } from './samples.ts';

const port = Number(process.env.PORT ?? 8787);
const app = new Hono();

app.route('/', api);

// In production the built web app (npm run build → dist/) is served from here too.
const dist = resolve('dist');
const indexFile = resolve(dist, 'index.html');
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
  // Client-side routes (/inbox, /b/:slug, …) all load the single-page app.
  app.get('*', (c) => c.html(indexHtml));
}

// A shared demo account with ~2.5 months of history, so there's something to explore immediately.
if (process.env.SEED_DEMO !== 'false' && !db.prepare('SELECT 1 FROM users WHERE email = ?').get(DEMO_EMAIL)) {
  const result = db
    .prepare('INSERT INTO users (name, email, org, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
    .run('Ayesha Rahman', DEMO_EMAIL, 'Northbridge University', await hashPassword('demo1234'), Date.now() - 90 * 86_400_000);
  seedSampleData(Number(result.lastInsertRowid));
  console.log(`Seeded demo account → ${DEMO_EMAIL} / demo1234`);
}

pruneSessions();
setInterval(pruneSessions, 6 * 3_600_000).unref();

serve({ fetch: app.fetch, port }, (info) => {
  const web = existsSync(indexFile) ? `http://localhost:${info.port}` : 'http://localhost:5173 (npm run dev)';
  console.log(`Kontho API listening on :${info.port} — open ${web}`);
});
