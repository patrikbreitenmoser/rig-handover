// Plan morning-digest § 1: read runs/<night>.jsonl into one row per job.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, ReadNight, RunLine, RunStatus } from './types.js';

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: readonly RunStatus[] = ['ok', 'retry', 'fail'];
const NO_OWNER = '—';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isStatus(v: unknown): v is RunStatus {
  return typeof v === 'string' && (STATUSES as readonly string[]).includes(v);
}

// One line of the log, or null if it is not a valid run line.
function parseLine(line: string): RunLine | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  const { at, job, status, owner, error } = value;
  if (typeof at !== 'string' || at === '') return null;
  if (typeof job !== 'string' || job === '') return null;
  if (!isStatus(status)) return null;
  const parsed: RunLine = { at, job, status, owner: typeof owner === 'string' ? owner : null };
  if (typeof error === 'string') parsed.error = error;
  return parsed;
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!NIGHT.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (err) {
    if (isRecord(err) && err.code === 'ENOENT') return null;
    throw err;
  }

  const byJob = new Map<string, DigestRow>();
  let badLines = 0;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '') continue;
    const run = parseLine(line);
    if (!run) {
      badLines++;
      continue;
    }
    const owner = run.owner && run.owner.trim() !== '' ? run.owner : NO_OWNER;
    const row = byJob.get(run.job);
    if (!row) {
      byJob.set(run.job, {
        job: run.job,
        owner,
        runs: 1,
        retries: run.status === 'retry' ? 1 : 0,
        last: run.status,
        lastError: run.error ?? null,
        first: run.at,
        lastAt: run.at,
      });
      continue;
    }
    row.runs++;
    if (run.status === 'retry') row.retries++;
    row.last = run.status;
    row.lastError = run.error ?? null;
    row.lastAt = run.at;
    if (row.owner === NO_OWNER && owner !== NO_OWNER) row.owner = owner;
  }

  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { night, rows, badLines };
};

// Rows by their last status, for the board.
export function counts(night: Night): { ok: number; retry: number; fail: number } {
  const c = { ok: 0, retry: 0, fail: 0 };
  for (const row of night.rows) c[row.last]++;
  return c;
}
