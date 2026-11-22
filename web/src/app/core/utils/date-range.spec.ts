import { formatDateRange } from './date-range';

describe('formatDateRange', () => {
  it('collapses ranges within one month', () => {
    expect(formatDateRange('2026-11-26', '2026-11-30')).toBe('26 – 30 Nov 2026');
  });

  it('shows both months when the range crosses a month', () => {
    expect(formatDateRange('2026-11-26', '2026-12-01')).toBe('26 Nov – 1 Dec 2026');
  });

  it('shows both years when the range crosses a year', () => {
    expect(formatDateRange('2026-12-28', '2027-01-02')).toBe('28 Dec 2026 – 2 Jan 2027');
  });

  it('shows a single date for one-day trips', () => {
    expect(formatDateRange('2026-11-26', '2026-11-26')).toBe('26 Nov 2026');
  });

  it('falls back to raw values when a date is invalid', () => {
    expect(formatDateRange('soon', '2026-11-26')).toBe('soon – 2026-11-26');
    expect(formatDateRange(undefined, undefined)).toBe('');
  });
});
