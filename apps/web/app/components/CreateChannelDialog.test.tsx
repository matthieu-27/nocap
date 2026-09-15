// @vitest-environment jsdom

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { CreateChannelDialog } from './CreateChannelDialog';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function tree(): React.ReactElement {
  return (
    <MemoryRouter>
      <CreateChannelDialog />
    </MemoryRouter>
  );
}

async function fillChannelForm(
  user: ReturnType<typeof userEvent.setup>,
): Promise<HTMLElement> {
  await user.click(screen.getByRole('button', { name: /create channel/i }));
  const dialog = screen.getByRole('dialog');
  await user.type(within(dialog).getByLabelText('Slug'), 'gaming');
  await user.type(within(dialog).getByLabelText('Name'), 'Gaming');
  return dialog;
}

describe('CreateChannelDialog', () => {
  it('submits slug and name to the api', async () => {
    const calls: Array<{ path: string; body: unknown }> = [];
    globalThis.fetch = (async (path: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ path: String(path), body: init?.body });
      return new Response('{}', {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof globalThis.fetch;
    const user = userEvent.setup();
    render(tree());
    const dialog = await fillChannelForm(user);
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));
    expect(calls[0]?.path).toBe('/api/domains');
    expect(calls[0]?.body).toBe('{"slug":"gaming","name":"Gaming"}');
  });

  it('surfaces the server error message on failure', async () => {
    globalThis.fetch = (async () =>
      new Response('{"error": "domain creation limit reached (3 per user)"}', {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof globalThis.fetch;
    const user = userEvent.setup();
    render(tree());
    const dialog = await fillChannelForm(user);
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));
    expect(screen.getByText(/limit reached/)).toBeInTheDocument();
  });
});
