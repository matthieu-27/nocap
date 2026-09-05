// @vitest-environment jsdom

import type { SessionUser } from '@nocap/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AccountMenu } from './AccountMenu';

const guest = null;
const trackfan: SessionUser = { id: 1, username: 'trackfan', role: 'user' };

describe('AccountMenu', () => {
  // No manual body-wiping afterEach: RTL cleanup (registered in
  // vitest.setup.ts) must unmount an open Radix portal itself — wiping
  // body.innerHTML first makes React's removeChild throw.

  // The buttons are shadcn `Button asChild` + react-router `Link`, so they
  // render as anchors: their accessible role is `link`, not `button`.
  it('logged-out visitor sees Log in and Sign up buttons', () => {
    render(
      <MemoryRouter>
        <AccountMenu user={guest} onSignOut={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign up' })).toBeInTheDocument();
  });

  // Radix DropdownMenu opens on pointerdown, which fireEvent.click does not
  // dispatch — user-event drives the full pointer sequence instead.
  it('logged-in user opens the dropdown and sees handle and Log out', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AccountMenu user={trackfan} onSignOut={() => {}} />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(screen.getByText('nocap/trackfan')).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'Log out' }),
    ).toBeInTheDocument();
  });

  it('logged-in user clicking Log out calls onSignOut', async () => {
    const onSignOut = vi.fn();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AccountMenu user={trackfan} onSignOut={onSignOut} />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Log out' }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
