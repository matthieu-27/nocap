// @vitest-environment jsdom
import type { DomainDto } from '@nocap/shared';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

// Better Auth's client closes over fetch when its module initializes, so the
// stub must be installed before ./submit (which imports the client) loads.
// Static imports hoist above any assignment — hence the dynamic import after.
interface RecordedCall {
  method: string;
  path: string;
  body?: string;
}
const calls: RecordedCall[] = [];
type Responder = (path: string) => Response;
let respond: Responder = () => jsonResponse(null);

globalThis.fetch = (async (path: RequestInfo | URL, init?: RequestInit) => {
  const url = String(path);
  calls.push({
    method: init?.method ?? 'GET',
    path: url,
    body: typeof init?.body === 'string' ? init.body : undefined,
  });
  return respond(url);
}) as typeof globalThis.fetch;

const { default: SubmitRoute } = await import('./submit');
const { authClient } = await import('@/lib/auth-client');

const domains: DomainDto[] = [
  {
    id: 1,
    slug: 'politics',
    name: 'Politics',
    description: null,
    isLocked: false,
  },
  {
    id: 2,
    slug: 'science',
    name: 'Science',
    description: null,
    isLocked: false,
  },
];

// hydrateSession types its dates as Date; JSON.stringify serializes them
// back to ISO strings on the wire, so one payload serves both uses.
const sessionPayload = {
  session: {
    id: 'session-1',
    userId: '1',
    token: 'token',
    expiresAt: new Date('2027-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ipAddress: '127.0.0.1',
    userAgent: 'test',
  },
  user: {
    id: '1',
    name: 'trackfan',
    username: 'trackfan',
    email: 'trackfan@example.org',
    emailVerified: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    role: 'user',
  },
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// The session atom is module state shared by every test in this file, and
// hydrateSession only fires while it still holds null — so this helper must
// run before render in each signed-in test (and the signed-out test must run
// first, while no hydration has happened yet).
function signIn(): void {
  respond = (path) =>
    path.includes('get-session')
      ? jsonResponse(sessionPayload)
      : jsonResponse(null);
  authClient.hydrateSession(sessionPayload);
}

function PostDestination(): ReactElement {
  const { id } = useParams();
  return <p>navigated to post {id}</p>;
}

// Route.ComponentProps types matches as the real match tuple (root + this
// route); mirror the two entries so the route renders with plain props.
function tree(): ReactElement {
  return (
    <MemoryRouter initialEntries={['/submit']}>
      <Routes>
        <Route
          path="/submit"
          element={
            <SubmitRoute
              loaderData={{ domains }}
              params={{}}
              actionData={undefined}
              matches={[
                {
                  id: 'root',
                  params: {},
                  pathname: '/',
                  loaderData: undefined,
                  handle: undefined,
                },
                {
                  id: 'routes/submit',
                  params: {},
                  pathname: '/submit',
                  loaderData: { domains },
                  handle: undefined,
                },
              ]}
            />
          }
        />
        <Route path="/p/:id" element={<PostDestination />} />
      </Routes>
    </MemoryRouter>
  );
}

function postCalls(): RecordedCall[] {
  return calls.filter(
    (call) => call.method === 'POST' && call.path.endsWith('/api/posts'),
  );
}

beforeEach(() => {
  calls.length = 0;
});

// The session atom may still have a get-session request in flight when the
// last assertion passes; let it settle so nothing resolves after teardown.
afterAll(async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
});

describe('SubmitRoute', () => {
  it('signed out visitor sees a login call to action instead of the form', async () => {
    respond = () => jsonResponse(null);
    render(tree());
    expect(
      screen.getByRole('link', { name: 'Log in to post' }),
    ).toHaveAttribute('href', '/login');
    expect(
      screen.queryByRole('button', { name: 'Post claim' }),
    ).not.toBeInTheDocument();
    // Wait for the background session fetch to settle inside act, so its
    // store update cannot leak into the next test's render.
    await waitFor(() => {
      expect(calls.some((call) => call.path.includes('get-session'))).toBe(
        true,
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  });

  it('renders every field with the v2 provider chips disabled and hint swapping', async () => {
    signIn();
    const user = userEvent.setup();
    render(tree());
    // Trigger shows the first domain's name, not its slug (Base UI items map).
    expect(screen.getByRole('combobox')).toHaveTextContent('Politics');
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Source URL')).toBeInTheDocument();
    expect(screen.getByLabelText('Body')).toBeInTheDocument();
    for (const name of ['YouTube', 'TikTok', 'Link']) {
      expect(screen.getByRole('button', { name })).toBeEnabled();
    }
    expect(
      screen.getByRole('button', { name: /Instagram Reel/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /Facebook Reel/ }),
    ).toBeDisabled();
    expect(
      screen.getByText('Paste a YouTube, TikTok, or any other link'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'YouTube' }));
    expect(screen.getByText('Paste a YouTube link')).toBeInTheDocument();
  });

  it('short title and non-url source are rejected before any fetch happens', async () => {
    signIn();
    const user = userEvent.setup();
    render(tree());
    await user.type(screen.getByLabelText('Title'), 'No');
    await user.type(screen.getByLabelText('Source URL'), 'not-a-url');
    await user.click(screen.getByRole('button', { name: 'Post claim' }));
    expect(
      screen.getByText('Title must be 5-300 characters'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(
      screen.getByText('Source URL must be a valid http or https URL'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Source URL')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(postCalls()).toHaveLength(0);
  });

  it('valid submission posts to the api and navigates to the new post', async () => {
    signIn();
    respond = (path) =>
      path.includes('get-session')
        ? jsonResponse(sessionPayload)
        : jsonResponse({ id: 42 });
    const user = userEvent.setup();
    render(tree());
    await user.type(
      screen.getByLabelText('Title'),
      'Did the flood claim hold up?',
    );
    await user.type(
      screen.getByLabelText('Source URL'),
      'https://example.org/flood',
    );
    await user.type(screen.getByLabelText('Body'), 'Local gauge data is off.');
    await user.click(screen.getByRole('button', { name: 'Post claim' }));
    expect(await screen.findByText('navigated to post 42')).toBeInTheDocument();
    expect(postCalls()).toHaveLength(1);
    expect(postCalls()[0]?.body).toBe(
      '{"domainSlug":"politics","title":"Did the flood claim hold up?","url":"https://example.org/flood","body":"Local gauge data is off."}',
    );
  });

  it('api rejection like a locked domain surfaces its message in an alert', async () => {
    signIn();
    respond = (path) =>
      path.includes('get-session')
        ? jsonResponse(sessionPayload)
        : jsonResponse({ error: 'domain is locked' }, 403);
    const user = userEvent.setup();
    render(tree());
    await user.type(
      screen.getByLabelText('Title'),
      'Is the leak really fixed?',
    );
    await user.type(
      screen.getByLabelText('Source URL'),
      'https://example.org/leak',
    );
    await user.click(screen.getByRole('button', { name: 'Post claim' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'domain is locked',
    );
    expect(screen.getByRole('button', { name: 'Post claim' })).toBeEnabled();
  });
});
