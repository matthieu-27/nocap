import { ApiError } from './api';

// Browser-side API client: same-origin fetch through the Vite dev proxy
// (Caddy in production), so the Better Auth session cookie rides along.
// The server-side apiFetch forwards cookies from a Request; this one IS
// the browser request.

export interface ApiJsonInit {
  method?: string;
  body?: string;
}

export async function apiJson<T>(
  path: string,
  init: ApiJsonInit = {},
): Promise<T> {
  const response = await fetch(path, {
    method: init.method ?? 'GET',
    body: init.body,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }
  return (await response.json()) as T;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === 'string' && body.error.length > 0) {
      return body.error;
    }
  } catch {
    // Unparseable body (proxy failure, empty 502): the generic message is
    // the information the fallback encodes.
    return `API request failed: ${response.url}`;
  }
  return `API request failed: ${response.url}`;
}
