import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from './api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('apiFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forwards the browser cookie header and returns parsed json', async () => {
    const fetchSpy = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchSpy);

    const request = new Request('http://localhost:3000/d/sports', {
      headers: { Cookie: 'nocap_session=abc' },
    });
    const result = await apiFetch<{ ok: boolean }>(request, '/api/domains');

    expect(result).toEqual({ ok: true });
    // biome-ignore format: the reason comment must stay on the assertion line (require-assertion-reason hook)
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]; // reason: the stub declares no parameters, so vitest types each call as an empty tuple, not fetch's [url, init]
    expect(url).toBe('http://localhost:3001/api/domains');
    expect(new Headers(init.headers).get('Cookie')).toBe('nocap_session=abc');
  });

  it('throws ApiError with the response status when the api rejects', async () => {
    vi.stubGlobal('fetch', async () => jsonResponse({ error: 'nope' }, 500));

    const request = new Request('http://localhost:3000/');
    try {
      await apiFetch(request, '/api/domains');
      throw new Error('expected apiFetch to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(500);
    }
  });
});
