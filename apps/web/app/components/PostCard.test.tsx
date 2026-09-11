// @vitest-environment jsdom

import type { PostDto } from '@nocap/shared';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { PostCard } from './PostCard';

const post: PostDto = {
  id: 1042,
  domainId: 1,
  domainSlug: 'sports',
  author: 'trackfan',
  title: 'Referee ignored three obvious fouls in Q4',
  body: null,
  url: 'https://youtu.be/dQw4w9WgXcQ',
  provider: null,
  embed: null,
  score: 47,
  createdAt: new Date('2026-09-11T10:00:00Z').toISOString(),
  viewerVote: null,
};

type CardProps = Parameters<typeof PostCard>[0];

function renderCard(overrides: Partial<CardProps> = {}): CardProps {
  const props: CardProps = {
    post,
    onVote: vi.fn(),
    onReport: vi.fn(),
    ...overrides,
  };
  render(
    <MemoryRouter>
      <PostCard {...props} />
    </MemoryRouter>,
  );
  return props;
}

describe('PostCard', () => {
  it('renders title and channel links with the question line', () => {
    renderCard();
    expect(
      screen.getByRole('link', { name: /Referee ignored three obvious fouls/ }),
    ).toHaveAttribute('href', '/p/1042');
    expect(screen.getByRole('link', { name: 'nocap/sports' })).toHaveAttribute(
      'href',
      '/d/sports',
    );
    expect(screen.getByText(/Is this well-sourced\?/)).toBeInTheDocument();
  });

  it('shows vote arrows plus share and report actions', () => {
    renderCard();
    expect(screen.getByRole('button', { name: 'upvote' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /report/i })).toBeInTheDocument();
  });

  it('omits the comment count when not provided', () => {
    renderCard();
    expect(screen.queryByText(/comments/)).not.toBeInTheDocument();
  });

  it('shows the comment count when passed', () => {
    renderCard({ commentCount: 12 });
    expect(screen.getByText('💬 12 comments')).toBeInTheDocument();
  });

  it('renders the link card fallback while embeds pend', () => {
    renderCard();
    expect(screen.getByText('youtu.be')).toBeInTheDocument();
  });
});
