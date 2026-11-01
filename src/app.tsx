import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { counts, readNight } from './digest/read.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { Digest } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) => {
    const status = readStatus(config);
    const nights = status.nights.map((night) => {
      const n = readNight(config.runsDir, night);
      return { night, counts: n ? counts(n) : null };
    });
    return c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={status} nights={nights} />
      </Layout>,
    );
  });

  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    const data = readNight(config.runsDir, night);
    if (!data) return c.notFound();
    return c.html(
      <Layout title={`digest ${night}`} lane={lane()}>
        <Digest night={data} />
      </Layout>,
    );
  });

  // Same readNight call as the digest page, so page and JSON never disagree (ADR 0001).
  app.get('/api/digest/:night', (c) => {
    const night = readNight(config.runsDir, c.req.param('night'));
    if (night === null) return c.json({ error: 'no such night' }, 404);
    return c.json(night);
  });

  return app;
}
