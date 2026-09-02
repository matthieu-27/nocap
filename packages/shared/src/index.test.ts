import { describe, expect, it } from 'vitest';
import type { VoteValue } from './index';

describe('shared vote values', () => {
  it('allows up down and clear', () => {
    const values: VoteValue[] = [1, -1, 0];
    expect(values).toEqual([1, -1, 0]);
  });
});
