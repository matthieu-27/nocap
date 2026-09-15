// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommentComposer } from './CommentComposer';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function tree(
  props: Partial<Parameters<typeof CommentComposer>[0]> = {},
): React.ReactElement {
  const full = {
    postId: 42,
    signedIn: true,
    parentId: null,
    onCommented: vi.fn(),
    ...props,
  };
  return (
    <MemoryRouter>
      <CommentComposer {...full} />
    </MemoryRouter>
  );
}

describe('CommentComposer', () => {
  it('signed out user gets a login link instead of the form', () => {
    render(tree({ signedIn: false }));
    expect(
      screen.getByRole('link', { name: /log in to comment/i }),
    ).toHaveAttribute('href', '/login');
    expect(screen.queryByLabelText('comment body')).not.toBeInTheDocument();
  });

  it('signed in user submits body and parent to the api', async () => {
    const calls: Array<{ path: string; body: unknown }> = [];
    globalThis.fetch = (async (path: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ path: String(path), body: init?.body });
      return new Response('{"id": 9}', {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof globalThis.fetch;
    const onCommented = vi.fn();
    const user = userEvent.setup();
    render(tree({ onCommented }));
    await user.type(
      screen.getByLabelText('comment body'),
      'The primary source confirms the number.',
    );
    await user.click(screen.getByRole('button', { name: 'Comment' }));
    expect(calls[0]?.path).toBe('/api/posts/42/comments');
    expect(calls[0]?.body).toBe(
      '{"body":"The primary source confirms the number.","parentId":null}',
    );
    expect(onCommented).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('comment body')).toHaveValue('');
  });

  it('reply composer sends the parent comment id', async () => {
    const calls: Array<{ path: string; body: unknown }> = [];
    globalThis.fetch = (async (path: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ path: String(path), body: init?.body });
      return new Response('{"id": 10}', {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof globalThis.fetch;
    const user = userEvent.setup();
    render(tree({ parentId: 11 }));
    await user.type(
      screen.getByLabelText('comment body'),
      'Replying with the receipt.',
    );
    await user.click(screen.getByRole('button', { name: 'Reply' }));
    expect(calls[0]?.body).toBe(
      '{"body":"Replying with the receipt.","parentId":11}',
    );
  });

  it('empty body is rejected before any fetch happens', async () => {
    const calls: unknown[] = [];
    globalThis.fetch = (async (path: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ path: String(path), body: init?.body });
      return new Response('{}', { status: 201 });
    }) as typeof globalThis.fetch;
    const user = userEvent.setup();
    render(tree());
    await user.click(screen.getByRole('button', { name: 'Comment' }));
    expect(calls).toHaveLength(0);
  });
});
