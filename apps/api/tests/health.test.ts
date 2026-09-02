import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { closeDb, resetDb } from '../src/db/testSetup';
import { app } from '../src/index';

describe('health route', () => {
  beforeEach(resetDb);
  afterAll(closeDb);

  it('returns ok status for unauthenticated caller', async () => {
    const response = await app.request('/api/health');
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string };
    expect(body.status).toBe('ok');
  });
});
