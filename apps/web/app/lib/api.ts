export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

// Server-side only (SSR loaders). The spec forbids web→DB: loaders proxy to
// the Hono API on localhost, forwarding the session cookie so authenticated
// data renders on the server too.
export async function apiFetch<T>(request: Request, path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Cookie: request.headers.get('Cookie') ?? '' },
  });
  if (!response.ok) {
    throw new ApiError(response.status, `API request failed: ${path}`);
  }
  return (await response.json()) as T;
}
