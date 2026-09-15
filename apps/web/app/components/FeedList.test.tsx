// @vitest-environment jsdom

import type { PostDto } from '@nocap/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { FeedList } from './FeedList';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function makePosts(count: number): PostDto[] {
  return Array.from(
    { length: count },
    (_, index): PostDto => ({
      id: index + 1,
      domainId: 1,
      domainSlug: 'sports',
      author: 'trackfan',
      title: `Claim number ${index + 1}`,
      body: null,
      url: 'https://example.com/a',
      provider: null,
      embed: null,
      score: 0,
      createdAt: '2026-09-11T10:00:00Z',
      viewerVote: null,
    }),
  );
}

function tree(posts: PostDto[], offset = 0): React.ReactElement {
  return (
    <MemoryRouter>
      <FeedList posts={posts} sort="hot" window="all" offset={offset} />
    </MemoryRouter>
  );
}

describe('FeedList', () => {
  it('renders one card per post', () => {
    render(tree(makePosts(3)));
    expect(
      screen.getByRole('link', { name: 'Claim number 1' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Claim number 2' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Claim number 3' }),
    ).toBeInTheDocument();
  });

  it('shows the empty state with a submit call to action', () => {
    render(tree([]));
    expect(screen.getByText('No claims yet')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Post a claim' }),
    ).toBeInTheDocument();
  });

  it('links load more to the next offset', () => {
    render(tree(makePosts(25)));
    expect(screen.getByRole('link', { name: 'Load more' })).toHaveAttribute(
      'href',
      expect.stringContaining('offset=25'),
    );
  });

  it('hides newer at offset zero and shows it later', () => {
    const first = render(tree(makePosts(25), 0));
    expect(
      screen.queryByRole('link', { name: 'Newer' }),
    ).not.toBeInTheDocument();
    first.unmount();
    render(tree(makePosts(25), 25));
    expect(screen.getByRole('link', { name: 'Newer' })).toHaveAttribute(
      'href',
      expect.stringContaining('offset=0'),
    );
  });

  it('votes optimistically through the api client', async () => {
    const calls: Array<{ path: string; body: unknown }> = [];
    globalThis.fetch = (async (path: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ path: String(path), body: init?.body });
      return new Response('{"score": 1}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof globalThis.fetch;
    const user = userEvent.setup();
    render(tree(makePosts(1)));
    await user.click(screen.getByRole('button', { name: 'upvote' }));
    expect(calls[0]?.path).toBe('/api/posts/1/vote');
    expect(calls[0]?.body).toBe('{"value":1}');
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});
