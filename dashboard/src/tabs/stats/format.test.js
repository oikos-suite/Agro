import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatHours, formatHoursShort, hoursOnLocalClock, periodDays, splitTitle } from './format.js';

describe('formatHours', () => {
  it('shows minutes alone under an hour, and nothing as 0m', () => {
    expect(formatHours(0)).toBe('0m');
    expect(formatHours(150)).toBe('3m');
  });

  it('shows hours and minutes from an hour up', () => {
    expect(formatHours(3600 * 2 + 60 * 5)).toBe('2h 5m');
  });
});

describe('formatHoursShort', () => {
  it('keeps one decimal under ten hours and drops a trailing .0', () => {
    expect(formatHoursShort(0)).toBe('0h');
    expect(formatHoursShort(5400)).toBe('1.5h');
    expect(formatHoursShort(7200)).toBe('2h');
  });

  it('rounds to whole hours from ten up', () => {
    expect(formatHoursShort(3600 * 12.4)).toBe('12h');
  });
});

describe('splitTitle', () => {
  it('splits "Title — Artist" on the last separator', () => {
    expect(splitTitle('A — B — Artist')).toEqual({ title: 'A — B', artist: 'Artist' });
  });

  it('leaves a name with no artist whole', () => {
    expect(splitTitle('Untitled')).toEqual({ title: 'Untitled', artist: '' });
  });
});

describe('periodDays', () => {
  it('uses the fixed length of a named period', () => {
    expect(periodDays('WEEK')).toBe(7);
    expect(periodDays('YEAR')).toBe(365);
  });

  it('measures ALL from the first play, and never returns less than a day', () => {
    const tenDaysAgo = Date.now() / 1000 - 10 * 86400;
    expect(periodDays('ALL', tenDaysAgo)).toBe(10);
    expect(periodDays('ALL', null)).toBe(1);
  });
});

describe('hoursOnLocalClock', () => {
  afterEach(() => vi.restoreAllMocks());
  const utc = Array.from({ length: 24 }, (_, hour) => hour);

  it('rotates UTC buckets onto a whole-hour offset', () => {
    // UTC+2: getTimezoneOffset() is minutes *behind* UTC, so -120.
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-120);
    const { values, local } = hoursOnLocalClock(utc);
    expect(local).toBe(true);
    expect(values[0]).toBe(22); // local midnight is 22:00 UTC
    expect(values[2]).toBe(0);
  });

  it('keeps UTC, and says so, for a half-hour zone', () => {
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-330);
    expect(hoursOnLocalClock(utc)).toEqual({ values: utc, local: false });
  });
});
