import { afterEach, describe, expect, it } from 'vitest';

import { ApiError } from './api';
import { apiJson } from './browser-api';

const originalFetch = globalThis.fetch;

function stubFetch(status: number, body: string): void {
  globalThis.fetch = (async () =>
    new Response(body, {
      status,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof globalThis.fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('browser api client', () => {
  it('returns the parsed json on success', async () => {
    stubFetch(200, '{"score": 1}');
    const result = await apiJson<{ score: number }>('/api/posts/1/vote', {
      method: 'POST',
      body: '{"value": 1}',
    });
    expect(result).toEqual({ score: 1 });
  });

  it('throws the server error message on failure', async () => {
    stubFetch(400, '{"error": "sort must be hot, new, or top"}');
    const call = apiJson('/api/posts?sort=bogus');
    await expect(call).rejects.toThrow('sort must be hot, new, or top');
    await expect(call).rejects.toBeInstanceOf(ApiError);
  });

  it('falls back to a generic message for non json errors', async () => {
    stubFetch(502, 'Bad Gateway');
    const call = apiJson('/api/posts');
    await expect(call).rejects.toThrow('API request failed');
  });

  it('sends credentials and the json content type', async () => {
    let seen: RequestInit | undefined;
    globalThis.fetch = (async (
      _path: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      seen = init;
      return new Response('{}', { status: 200 });
    }) as typeof globalThis.fetch;
    await apiJson('/api/posts');
    expect(seen?.credentials).toBe('same-origin');
    expect(seen?.headers).toEqual({ 'Content-Type': 'application/json' });
  });
});
