// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingOverlay } from './LoadingOverlay';

describe('LoadingOverlay', () => {
  it('renders the saucer mark over the beam and glow on a black frame', () => {
    const { container } = render(<LoadingOverlay phase="loading" />);

    const frame = screen.getByRole('status');
    expect(frame.className).toContain('bg-[#0a0612]');
    expect(screen.getByText('abducting the receipts…')).toBeInTheDocument();

    // alt="" keeps the mark decorative, so query it structurally
    const mark = container.querySelector('img');
    expect(mark).toHaveAttribute('src', '/logo.svg');
    expect(mark?.className).toContain('nocap-wobble');

    expect(container.querySelector('.nocap-beam')).not.toBeNull();
    expect(container.querySelector('.nocap-pulse')).not.toBeNull();
    expect(frame.className).not.toContain('nocap-exit');
  });

  it('switches to the fly-away exit animation when phase is exiting', () => {
    const { container } = render(<LoadingOverlay phase="exiting" />);

    const frame = screen.getByRole('status');
    expect(frame.className).toContain('nocap-exit');
    // the hover loop stops so the ship animation takes over
    expect(container.querySelector('.nocap-wobble')?.className).toContain(
      'nocap-ship',
    );
  });

  it('renders a custom caption when one is passed', () => {
    render(<LoadingOverlay phase="loading" caption="beaming up…" />);
    expect(screen.getByText('beaming up…')).toBeInTheDocument();
  });
});
