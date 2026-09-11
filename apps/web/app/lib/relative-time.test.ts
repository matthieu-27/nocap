import { describe, expect, it } from 'vitest';

import { timeAgo } from './relative-time';

const NOW = new Date('2026-09-11T12:00:00Z');

describe('relative time', () => {
  it('returns just now under one minute', () => {
    expect(timeAgo('2026-09-11T11:59:30Z', NOW)).toBe('just now');
  });

  it('returns minutes under one hour', () => {
    expect(timeAgo('2026-09-11T11:30:00Z', NOW)).toBe('30 m ago');
  });

  it('returns hours under one day', () => {
    expect(timeAgo('2026-09-11T08:00:00Z', NOW)).toBe('4 h ago');
  });

  it('returns days under one week', () => {
    expect(timeAgo('2026-09-09T12:00:00Z', NOW)).toBe('2 d ago');
  });

  it('returns weeks beyond one week', () => {
    expect(timeAgo('2026-09-01T12:00:00Z', NOW)).toBe('1 w ago');
  });

  it('guards invalid dates with a fallback label', () => {
    expect(timeAgo('not a date', NOW)).toBe('unknown date');
  });
});
