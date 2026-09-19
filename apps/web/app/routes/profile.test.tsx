// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import ProfileRoute from './profile';

// React Router's typegen serializes `embed: unknown` to `undefined` in the
// generated loaderData type, so the fixtures mirror that shape here — the
// profile rows never read embed anyway.
const posts = [
  {
    id: 101,
    domainId: 1,
    domainSlug: 'politics',
    author: 'trackfan',
    title: 'Did the debate shift polling by five points?',
    body: null,
    url: 'https://example.com/debate',
    provider: 'link',
    embed: undefined,
    score: 12,
    createdAt: '2026-09-10T10:00:00.000Z',
  },
  {
    id: 102,
    domainId: 2,
    domainSlug: 'science',
    author: 'trackfan',
    title: 'Is the replication crisis over in social psychology?',
    body: null,
    url: 'https://example.com/replication',
    provider: null,
    embed: undefined,
    score: 3,
    createdAt: '2026-09-15T10:00:00.000Z',
  },
];

const profile = {
  username: 'trackfan',
  role: 'user',
  swag: 42,
  postSwag: 30,
  commentSwag: 12,
  createdAt: '2025-03-15T10:00:00.000Z',
  posts,
  commentCount: 7,
};

// Route.ComponentProps types matches as the real match tuple (root + shell +
// this route); mirror the entries so the route renders with plain props.
function ui(): ReactElement {
  return (
    <MemoryRouter initialEntries={['/u/trackfan']}>
      <Routes>
        <Route
          path="/u/:username"
          element={
            <ProfileRoute
              loaderData={{ profile }}
              params={{ username: 'trackfan' }}
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
                  id: 'routes/_shell',
                  params: {},
                  pathname: '/',
                  loaderData: { domains: [] },
                  handle: undefined,
                },
                {
                  id: 'routes/profile',
                  params: { username: 'trackfan' },
                  pathname: '/u/trackfan',
                  loaderData: { profile },
                  handle: undefined,
                },
              ]}
            />
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProfileRoute', () => {
  it('renders header stats from the profile dto', () => {
    render(ui());
    expect(screen.getByRole('heading', { name: 'u/trackfan' })).toBeTruthy();
    expect(screen.getByText('42 swag')).toBeTruthy();
    expect(screen.getByText('2 posts')).toBeTruthy();
    expect(screen.getByText('7 comments')).toBeTruthy();
    expect(screen.getByText('member since Mar 2025')).toBeTruthy();
    expect(screen.getByText('TR')).toBeTruthy();
  });

  it('lists post rows with links on the posts tab', () => {
    render(ui());
    expect(
      screen.getByRole('link', {
        name: 'Did the debate shift polling by five points?',
      }),
    ).toHaveAttribute('href', '/p/101');
    expect(screen.getByRole('link', { name: 'r/politics' })).toHaveAttribute(
      'href',
      '/d/politics',
    );
    expect(screen.getByText('+12')).toBeTruthy();
  });

  it('shows the count-only note on the comments tab', async () => {
    render(ui());
    await userEvent.click(screen.getByRole('tab', { name: 'Comments' }));
    expect(
      screen.getByText(/7 comments across the site — comment browsing/),
    ).toBeTruthy();
  });

  it('shows both swag breakdown numbers', () => {
    render(ui());
    expect(screen.getByText('Swag breakdown')).toBeTruthy();
    expect(screen.getByText('30')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
  });
});
