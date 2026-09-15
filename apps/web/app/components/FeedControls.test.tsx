// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { FeedControls } from './FeedControls';

function tree(
  sort: 'hot' | 'new' | 'top',
  window: 'day' | 'week' | 'all',
): React.ReactElement {
  return (
    <MemoryRouter initialEntries={['/']}>
      <FeedControls sort={sort} window={window} />
    </MemoryRouter>
  );
}

describe('FeedControls', () => {
  it('links the three sort tabs to their query params', () => {
    render(tree('hot', 'all'));
    expect(screen.getByRole('tab', { name: 'Hot' })).toHaveAttribute(
      'href',
      expect.stringContaining('sort=hot'),
    );
    expect(screen.getByRole('tab', { name: 'New' })).toHaveAttribute(
      'href',
      expect.stringContaining('sort=new'),
    );
    expect(screen.getByRole('tab', { name: 'Top' })).toHaveAttribute(
      'href',
      expect.stringContaining('sort=top'),
    );
  });

  it('shows window chips only under the top sort', () => {
    const first = render(tree('hot', 'all'));
    expect(
      screen.queryByRole('link', { name: 'Week' }),
    ).not.toBeInTheDocument();
    first.unmount();
    render(tree('top', 'week'));
    expect(screen.getByRole('link', { name: 'Day' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Week' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All time' })).toBeInTheDocument();
  });

  it('links window chips to the top sort with their window', () => {
    render(tree('top', 'week'));
    expect(screen.getByRole('link', { name: 'Day' })).toHaveAttribute(
      'href',
      expect.stringContaining('window=day'),
    );
    expect(screen.getByRole('link', { name: 'All time' })).toHaveAttribute(
      'href',
      expect.stringContaining('window=all'),
    );
  });
});
