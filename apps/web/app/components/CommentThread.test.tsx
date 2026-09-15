// @vitest-environment jsdom

import type { CommentDto } from '@nocap/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommentThread } from './CommentThread';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const root: CommentDto = {
  id: 11,
  postId: 42,
  parentId: null,
  depth: 0,
  author: 'latecomer',
  body: 'Checked the source — the numbers hold up.',
  score: 5,
  createdAt: new Date('2026-09-12T18:00:00Z').toISOString(),
  viewerVote: null,
};

const secondRoot: CommentDto = {
  id: 12,
  postId: 42,
  parentId: null,
  depth: 0,
  author: 'earlybird',
  body: 'I traced the claim to the primary paper.',
  score: 1,
  createdAt: new Date('2026-09-12T10:00:00Z').toISOString(),
  viewerVote: null,
};

const child: CommentDto = {
  id: 21,
  postId: 42,
  parentId: 11,
  depth: 1,
  author: 'sourcerer',
  body: 'Same here — the appendix table backs it.',
  score: 0,
  createdAt: new Date('2026-09-12T19:00:00Z').toISOString(),
  viewerVote: null,
};

function tree(
  props: Partial<Parameters<typeof CommentThread>[0]> = {},
): React.ReactElement {
  const full = {
    postId: 42,
    // the API returns comments oldest-first: earlybird 10:00 < latecomer
    // 18:00 < child reply 19:00
    comments: [secondRoot, root, child],
    signedIn: true,
    onThreadChanged: vi.fn(),
    ...props,
  };
  return <CommentThread {...full} />;
}

function latecomerComesFirst(): boolean {
  const latecomer = screen.getByText('u/latecomer');
  const earlybird = screen.getByText('u/earlybird');
  return (
    (latecomer.compareDocumentPosition(earlybird) &
      Node.DOCUMENT_POSITION_FOLLOWING) !==
    0
  );
}

describe('CommentThread', () => {
  it('renders a nested reply under its parent behind a thread line', () => {
    render(tree());
    expect(screen.getByText(/appendix table backs it/)).toBeInTheDocument();
    const threadLine = screen
      .getByText(/appendix table backs it/)
      .closest('div.border-l');
    expect(threadLine).not.toBeNull();
    expect(screen.getByRole('button', { name: '1 reply' })).toBeInTheDocument();
  });

  it('vote click posts to the clicked comment vote endpoint', async () => {
    const calls: Array<{ path: string; body: unknown }> = [];
    globalThis.fetch = (async (path: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ path: String(path), body: init?.body });
      return new Response('{"score": 6}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof globalThis.fetch;
    const user = userEvent.setup();
    render(tree());
    // best sort puts the score-5 latecomer (id 11) first in the DOM
    const firstUpvote = screen.getAllByRole('button', { name: 'upvote' })[0];
    if (!firstUpvote) throw new Error('no upvote buttons rendered');
    await user.click(firstUpvote);
    expect(calls[0]?.path).toBe('/api/comments/11/vote');
    expect(calls[0]?.body).toBe('{"value":1}');
  });

  it('sort tabs reorder the top level while replies stay anchored', async () => {
    const user = userEvent.setup();
    render(tree());
    // best = score desc: latecomer (5) before earlybird (1)
    expect(latecomerComesFirst()).toBe(true);
    await user.click(screen.getByRole('tab', { name: 'New' }));
    // new = createdAt asc: earlybird posted first, so it leads
    expect(latecomerComesFirst()).toBe(false);
    expect(screen.getByText(/appendix table backs it/)).toBeInTheDocument();
  });
});
