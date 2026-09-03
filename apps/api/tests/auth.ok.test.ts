import { describe, expect, it } from 'bun:test';
import { app } from '../src/index';

describe('better auth mount', () => {
  it('api auth ok endpoint reports status ok', async () => {
    const res = await app.request('/api/auth/ok');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});
