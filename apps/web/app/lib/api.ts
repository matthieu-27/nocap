export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// import.meta.env.SSR is statically replaced by Vite, so the browser bundle
// never evaluates process.env (undefined there — it crashed hydration).
const API_URL = import.meta.env.SSR
  ? (process.env.API_URL ?? 'http://localhost:3001')
  : null;

// Server-side only (SSR loaders). The spec forbids web→DB: loaders proxy to
// the Hono API on localhost, forwarding the session cookie so authenticated
// data renders on the server too. Browser interactions go through apiJson
// (browser-api.ts) — framework mode runs plain loaders on the server even
// for client-side navigations, so this never runs in the browser.
export async function apiFetch<T>(request: Request, path: string): Promise<T> {
  if (API_URL === null) {
    throw new Error(
      'apiFetch is server-only — use apiJson from browser-api.ts in the browser',
    );
  }
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Cookie: request.headers.get('Cookie') ?? '' },
  });
  if (!response.ok) {
    throw new ApiError(response.status, `API request failed: ${path}`);
  }
  return (await response.json()) as T;
}
