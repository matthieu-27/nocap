// @vitest-environment jsdom

import type { SessionUser } from '@nocap/shared';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { Navbar } from './Navbar';

const trackfan: SessionUser = { id: 1, username: 'trackfan', role: 'user' };

describe('Navbar', () => {
  it('renders logo wordmark, search, theme toggle, and account area', () => {
    render(
      <MemoryRouter>
        <Navbar user={trackfan} onSignOut={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText('NoCaP')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Toggle theme' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Account menu' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
  });
});
