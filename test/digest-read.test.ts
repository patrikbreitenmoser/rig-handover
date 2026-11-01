import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { counts, readNight } from '../src/digest/read.js';

const tmpDirs: string[] = [];
function tempRuns(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  tmpDirs.push(dir);
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');
  const row = (job: string) => night?.rows.find((r) => r.job === job);

  it('has 5 jobs, sorted, and 1 bad line', () => {
    expect(night).not.toBeNull();
    expect(night?.badLines).toBe(1);
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('shows a null owner as an em dash', () => {
    expect(row('digest/render')?.owner).toBe('—');
  });

  it('fixtures/refresh ends ok after 3 retries', () => {
    expect(row('fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      last: 'ok',
      lastError: null,
      first: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('notes/backup ends in fail with its error', () => {
    expect(row('notes/backup')?.last).toBe('fail');
    expect(row('notes/backup')?.lastError).toBe('quota exceeded');
  });

  it('keeps the offset on times', () => {
    expect(row('lane/sync')?.first).toBe('2026-10-28T23:00:06+01:00');
  });

  it('counts rows by last status', () => {
    expect(night && counts(night)).toEqual({ ok: 4, retry: 0, fail: 1 });
  });
});

describe('readNight edge cases', () => {
  it('returns null for a night with no file', () => {
    expect(readNight('runs', '2026-01-01')).toBeNull();
  });

  it('returns null for a night that is not YYYY-MM-DD', () => {
    expect(readNight('runs', '../package')).toBeNull();
    expect(readNight('runs', '2026-10-28.jsonl')).toBeNull();
  });

  it('reads an empty file as no rows and no bad lines', () => {
    const dir = tempRuns({ '2026-11-01.jsonl': '' });
    expect(readNight(dir, '2026-11-01')).toEqual({ night: '2026-11-01', rows: [], badLines: 0 });
  });

  it('skips blank lines and counts invalid ones', () => {
    const dir = tempRuns({
      '2026-11-02.jsonl': [
        '',
        '{"at":"2026-11-02T01:00:00+01:00","job":"a","status":"ok","owner":""}',
        '   ',
        '{"at":"2026-11-02T01:00:00+01:00","job":"b","status":"maybe","owner":"x"}',
        '{"job":"c","status":"ok","owner":"x"}',
        '[]',
        '',
      ].join('\n'),
    });
    const night = readNight(dir, '2026-11-02');
    expect(night?.badLines).toBe(3);
    expect(night?.rows).toHaveLength(1);
    expect(night?.rows[0]?.owner).toBe('—');
  });
});
