// @vitest-environment jsdom

import type { ModPostDto } from '@nocap/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';
import { ModPostsTable } from './ModPostsTable';

// The select popup relies on scrollIntoView and pointer capture, which jsdom
// does not implement; without these shims the trigger never reports open.
// (Radix needed all three; Base UI no longer uses pointer capture, but the
// shims stay so either implementation works in this environment.)
beforeAll(() => {
  const proto = window.HTMLElement.prototype as Partial<HTMLElement> & {
    scrollIntoView?: () => void;
    hasPointerCapture?: () => boolean;
    releasePointerCapture?: () => void;
  };
  proto.scrollIntoView = () => {};
  proto.hasPointerCapture = () => false;
  proto.releasePointerCapture = () => {};
});

function post(overrides: Partial<ModPostDto>): ModPostDto {
  return {
    id: 1,
    domainId: 1,
    domainSlug: 'tech',
    author: 'alice',
    title: 'untitled',
    body: null,
    url: 'https://example.com/a',
    provider: null,
    embed: null,
    score: 0,
    createdAt: '2026-09-05T10:00:00Z',
    removedAt: null,
    openReports: 0,
    ...overrides,
  };
}

const fixture: ModPostDto[] = [
  post({
    id: 1,
    domainSlug: 'tech',
    title: 'Goldfish learned Rust',
    score: 10,
    createdAt: '2026-09-05T10:00:00Z',
  }),
  post({
    id: 2,
    domainSlug: 'sports',
    title: 'Backwards mile claim',
    score: 3,
    createdAt: '2026-09-05T11:00:00Z',
    openReports: 2,
  }),
  post({
    id: 3,
    domainSlug: 'tech',
    title: 'Removed toaster post',
    score: 7,
    createdAt: '2026-09-05T12:00:00Z',
    removedAt: '2026-09-05T13:00:00Z',
    openReports: 1,
  }),
];

function bodyRowCount(): number {
  return document.querySelectorAll('tbody tr').length;
}

describe('ModPostsTable', () => {
  it('mod table renders posts with channels, badges, and counters', () => {
    render(<ModPostsTable posts={fixture} />);
    expect(
      screen.getByRole('link', { name: /Goldfish learned Rust/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('nocap/tech')).toHaveLength(2);
    expect(screen.getByText('nocap/sports')).toBeInTheDocument();
    expect(screen.getByText('removed')).toBeInTheDocument();
    expect(
      screen.getByText('3 posts · 1 removed · 3 open reports'),
    ).toBeInTheDocument();
  });

  // TanStack v9 toggles score columns descending first, ascending second.
  it('mod clicking the Score header re-sorts posts by score', async () => {
    const user = userEvent.setup();
    render(<ModPostsTable posts={fixture} />);
    const links = () => screen.getAllByRole('link');
    // Initial sort is createdAt desc: toaster (12:00) first.
    expect(links()[0]?.textContent).toContain('Removed toaster post');

    await user.click(screen.getByRole('button', { name: 'Score' }));
    expect(links()[0]?.textContent).toContain('Goldfish learned Rust');

    await user.click(screen.getByRole('button', { name: 'Score' }));
    expect(links()[0]?.textContent).toContain('Backwards mile claim');
  });

  // The select trigger opens on pointerdown — user-event drives the full
  // pointer sequence (same lesson as AccountMenu's DropdownMenu).
  it('mod selecting a channel filters the table to that channel', async () => {
    const user = userEvent.setup();
    render(<ModPostsTable posts={fixture} />);
    await user.click(
      screen.getByRole('combobox', { name: 'Filter by channel' }),
    );
    await user.click(
      await screen.findByRole('option', { name: 'nocap/sports' }),
    );

    expect(
      screen.queryByRole('link', { name: /Goldfish learned Rust/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Backwards mile claim/ }),
    ).toBeInTheDocument();
    expect(bodyRowCount()).toBe(1);
  });
});
