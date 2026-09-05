// @vitest-environment jsdom

import type { DomainDto } from '@nocap/shared';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ChannelSidebar } from './ChannelSidebar';

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
  domains: DomainDto[];
  activeSlug: string | null;
}): React.ReactElement {
  return (
    <MemoryRouter>
      <ChannelSidebar
        domains={props?.domains ?? domains}
        activeSlug={props?.activeSlug ?? 'sports'}
      />
    </MemoryRouter>
  );
}

describe('ChannelSidebar', () => {
  it('renders each domain as a nocap-prefixed channel link', () => {
    render(componentTree());
    expect(
      screen.getByRole('link', { name: 'nocap/sports' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'nocap/politics' }),
    ).toBeInTheDocument();
  });

  it('marks the active channel link as the current page', () => {
    render(componentTree());
    expect(
      screen.getByRole('link', { name: 'nocap/sports', current: 'page' }),
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
});
