import type { Status } from '../status.js';

export type NightCounts = { night: string; counts: { ok: number; retry: number; fail: number } | null };

export function StatusBoard({ status, nights }: { status: Status; nights: NightCounts[] }) {
  return (
    <>
      <h1>status</h1>
      <table>
        <tbody>
          <tr><th>adapter</th><td>{status.adapter}</td></tr>
          <tr><th>installed</th><td>{status.installed}</td></tr>
          <tr>
            <th>last beat</th>
            <td>{status.lastBeat ? `${status.lastBeat.at} · pid ${status.lastBeat.pid}` : <span class="warn">none</span>}</td>
          </tr>
        </tbody>
      </table>
      <h2>nights on disk</h2>
      {nights.length === 0 ? (
        <p class="mute">nothing in runs/</p>
      ) : (
        <ul>
          {nights.map(({ night, counts }) => (
            <li>
              <a href={`/digest/${night}`}>{night}</a>{' '}
              {counts ? `ok ${counts.ok} · retry ${counts.retry} · fail ${counts.fail}` : '—'}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
