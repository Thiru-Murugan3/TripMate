const DAY = new Intl.DateTimeFormat('en-IN', { day: 'numeric' });
const DAY_MONTH = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const FULL = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function parseIsoDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Formats an ISO date range compactly, e.g.
 * "26 – 30 Nov 2026", "26 Nov – 1 Dec 2026", "28 Dec 2026 – 2 Jan 2027".
 * Falls back to the raw values when a date cannot be parsed.
 */
export function formatDateRange(start?: string | null, end?: string | null): string {
  const from = parseIsoDate(start);
  const to = parseIsoDate(end);
  if (!from || !to) return [start, end].filter(Boolean).join(' – ');

  if (from.getTime() === to.getTime()) return FULL.format(from);
  if (from.getFullYear() !== to.getFullYear()) return `${FULL.format(from)} – ${FULL.format(to)}`;
  if (from.getMonth() !== to.getMonth()) return `${DAY_MONTH.format(from)} – ${FULL.format(to)}`;
  return `${DAY.format(from)} – ${FULL.format(to)}`;
}
