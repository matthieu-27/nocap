// @vitest-environment jsdom

import type { DomainDto, SessionUser } from '@nocap/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ChannelSidebar } from './ChannelSidebar';

const trackfan: SessionUser = {
  id: 1,
  username: 'trackfan',
  role: 'user',
};

const domains: DomainDto[] = [
  { id: 1, slug: 'all', name: 'All', description: null, isLocked: false },
  { id: 2, slug: 'sports', name: 'Sports', description: null, isLocked: false },
  {
    id: 3,
    slug: 'politics',
    name: 'Politics',
    description: null,
    isLocked: false,
  },
];

function componentTree(props?: {
  domains?: DomainDto[];
  activeSlug?: string | null;
  user?: SessionUser | null;
}): React.ReactElement {
  return (
    <MemoryRouter>
      <ChannelSidebar
        domains={props?.domains ?? domains}
        activeSlug={props?.activeSlug ?? 'sports'}
        user={props?.user ?? null}
      />
    </MemoryRouter>
  );
}

describe('ChannelSidebar', () => {
  it('renders each domain as an r/-prefixed channel link', () => {
    render(componentTree());
    expect(screen.getByRole('link', { name: 'r/sports' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'r/politics' }),
    ).toBeInTheDocument();
  });

  it('marks the active channel link as the current page', () => {
    render(componentTree());
    expect(
      screen.getByRole('link', { name: 'r/sports', current: 'page' }),
    ).toBeInTheDocument();
  });

  it('renders the Legal column with Terms, Privacy, and Contact links', () => {
    render(componentTree());
    expect(
      screen.getByRole('link', { name: 'Terms of Service' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Privacy Policy' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact' })).toBeInTheDocument();
  });

  it('shows the empty state when no channels exist', () => {
    render(componentTree({ domains: [], activeSlug: null }));
    expect(screen.getByText('No channels yet.')).toBeInTheDocument();
  });

  it('offers channel creation to signed-in users only', () => {
    render(componentTree({ user: trackfan }));
    expect(
      screen.getByRole('button', { name: /create channel/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('3 max')).toBeInTheDocument();
  });

  it('opens the create channel dialog from the sidebar entry', async () => {
    const user = userEvent.setup();
    render(componentTree({ user: trackfan }));
    await user.click(screen.getByRole('button', { name: /create channel/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Create a channel')).toBeInTheDocument();
  });

  it('hides the create channel entry for anonymous visitors', () => {
    render(componentTree({ user: null }));
    expect(
      screen.queryByRole('button', { name: /create channel/i }),
    ).not.toBeInTheDocument();
  });
});
