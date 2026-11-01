import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

// Plan morning-digest § 2d. A temp runs dir: runs/ is read-only.
const runsDir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
writeFileSync(join(runsDir, '2026-01-01.jsonl'), '');
writeFileSync(
  join(runsDir, '2026-01-02.jsonl'),
  [
    '{"at":"2026-01-02T01:00:00+01:00","job":"b/job","status":"fail","owner":"rook","error":"boom"}',
    'not json',
    '{"at":"2026-01-02T00:30:00+01:00","job":"a/job","status":"ok","owner":null}',
    '',
  ].join('\n'),
);
const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir };
const app = () => createApp(config);

describe('GET /digest/:night', () => {
  it('200 with the rows, sorted by job, fail marked, bad line counted', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await app().request('/digest/2026-01-02');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html.indexOf('<td>a/job</td>')).toBeLessThan(html.indexOf('<td>b/job</td>'));
    expect(html).toContain('<td class="warn">fail</td>');
    expect(html).toContain('<td>—</td>');
    expect(html).not.toContain('null');
    expect(html).toContain('1 line(s) could not be read');
  });

  it('404 for a night with no file', async () => {
    expect((await app().request('/digest/2026-01-03')).status).toBe(404);
  });

  it('an empty night renders "nothing ran"', async () => {
    const res = await app().request('/digest/2026-01-01');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });
});

describe('GET /api/digest/:night', () => {
  it('200 with the same rows as the page', async () => {
    const res = await app().request('/api/digest/2026-01-02');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.rows.map((r: { job: string }) => r.job)).toEqual(['a/job', 'b/job']);
    expect(json.badLines).toBe(1);
  });

  it('404 for a night with no file', async () => {
    expect((await app().request('/api/digest/2026-01-03')).status).toBe(404);
  });

  it('an empty night has no rows', async () => {
    expect(await (await app().request('/api/digest/2026-01-01')).json()).toEqual({
      night: '2026-01-01',
      rows: [],
      badLines: 0,
    });
  });

  it('page and JSON agree on runs/2026-10-28', async () => {
    const real = createApp({ ...config, runsDir: 'runs' });
    const json = await (await real.request('/api/digest/2026-10-28')).json();
    const html = await (await real.request('/digest/2026-10-28')).text();
    const at = json.rows.map((r: { job: string }) => html.indexOf(`<td>${r.job}</td>`));
    expect(json.rows).toHaveLength(5);
    expect(at.every((i: number) => i > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });
});

describe('status board', () => {
  it('links each night to its digest with counts', async () => {
    const html = await (await app().request('/')).text();
    expect(html).toContain('<a href="/digest/2026-01-01">');
    expect(html).toContain('ok 0 · retry 0 · fail 0');
    expect(html).toContain('ok 1 · retry 0 · fail 1');
  });
});
