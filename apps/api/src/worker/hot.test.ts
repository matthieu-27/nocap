import { describe, expect, it } from 'bun:test';
import { hotRank } from './hot';

const NOW = new Date('2026-09-13T12:00:00Z');
const FRESH = new Date('2026-09-13T11:00:00Z');
const DAY_OLD = new Date('2026-09-12T12:00:00Z');
const WEEK_OLD = new Date('2026-09-06T12:00:00Z');

describe('hotRank', () => {
  it('ranks higher scored fresh posts above lower scored ones', () => {
    expect(hotRank(100, FRESH, NOW)).toBeGreaterThan(hotRank(10, FRESH, NOW));
    expect(hotRank(10, FRESH, NOW)).toBeGreaterThan(hotRank(1, FRESH, NOW));
  });

  it('decays rank as the same post ages', () => {
    expect(hotRank(10, FRESH, NOW)).toBeGreaterThan(hotRank(10, DAY_OLD, NOW));
    expect(hotRank(10, DAY_OLD, NOW)).toBeGreaterThan(
      hotRank(10, WEEK_OLD, NOW),
    );
  });

  it('needs about ten times the score after twelve hours to keep pace', () => {
    // decay = ageHours/12, so a 12h-old post loses log10(10): matching its
    // rank needs ~10x the score (score+1 must grow tenfold, per the log).
    const twelveHoursOld = new Date('2026-09-13T00:00:00Z');
    const aged = hotRank(99, twelveHoursOld, NOW);
    expect(hotRank(99, FRESH, NOW)).toBeGreaterThan(aged);
    expect(hotRank(9, FRESH, NOW)).toBeLessThan(aged);
  });

  it('treats negative scores as the floor instead of returning NaN', () => {
    const negative = hotRank(-5, FRESH, NOW);
    expect(Number.isFinite(negative)).toBe(true);
    expect(negative).toBeCloseTo(hotRank(0, FRESH, NOW));
  });

  it('stays deterministic because the clock is injected', () => {
    expect(hotRank(7, FRESH, NOW)).toBe(hotRank(7, FRESH, NOW));
    expect(hotRank(7, FRESH, NOW)).toBeCloseTo(Math.log10(8) - 1 / 12, 10);
  });
});
