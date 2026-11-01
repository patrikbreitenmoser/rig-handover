// Plan morning-digest § 1. Everything in section 2 builds against this file.
export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, parsed.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job. Times keep the offset from the log (styleguide).
export type DigestRow = {
  job: string;
  owner: string; // "—" when the log has no owner
  runs: number;
  retries: number;
  last: RunStatus;
  lastError: string | null;
  first: string;
  lastAt: string;
};

export type Night = {
  night: string;
  rows: DigestRow[]; // sorted by job
  badLines: number; // lines that did not parse, counted, never thrown
};

// null when runs/<night>.jsonl does not exist.
export type ReadNight = (runsDir: string, night: string) => Night | null;
