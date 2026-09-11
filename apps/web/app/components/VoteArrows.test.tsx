// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { VoteArrows } from './VoteArrows';

describe('VoteArrows', () => {
  it('renders the score with neutral arrows', () => {
    render(<VoteArrows score={42} viewerVote={null} onVote={vi.fn()} />);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'upvote' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('marks the active upvote arrow as pressed', () => {
    render(<VoteArrows score={42} viewerVote={1} onVote={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'upvote' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'downvote' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('clicking the active arrow removes the vote', async () => {
    const onVote = vi.fn();
    const user = userEvent.setup();
    render(<VoteArrows score={1} viewerVote={1} onVote={onVote} />);
    await user.click(screen.getByRole('button', { name: 'upvote' }));
    expect(onVote).toHaveBeenCalledWith(0);
  });

  it('clicking up while downvoted flips the vote', async () => {
    const onVote = vi.fn();
    const user = userEvent.setup();
    render(<VoteArrows score={-2} viewerVote={-1} onVote={onVote} />);
    await user.click(screen.getByRole('button', { name: 'upvote' }));
    expect(onVote).toHaveBeenCalledWith(1);
  });
});
