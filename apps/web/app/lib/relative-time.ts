const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** Pure relative-time label: "just now" / "N m| h| d| w ago". The caller
 * injects `now` so tests and SSR render deterministically. */
export function timeAgo(iso: string, now: Date): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return 'unknown date';
  }
  const elapsed = now.getTime() - then;
  if (elapsed < MINUTE) {
    return 'just now';
  }
  if (elapsed < HOUR) {
    return `${Math.floor(elapsed / MINUTE)} m ago`;
  }
  if (elapsed < DAY) {
    return `${Math.floor(elapsed / HOUR)} h ago`;
  }
  if (elapsed < WEEK) {
    return `${Math.floor(elapsed / DAY)} d ago`;
  }
  return `${Math.floor(elapsed / WEEK)} w ago`;
}
