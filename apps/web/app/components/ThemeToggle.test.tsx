// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ThemeProvider } from '@/contexts/theme-provider';
import { ThemeToggle } from './ThemeToggle';

function tree(): React.ReactElement {
  return (
    <ThemeProvider defaultTheme="light">
      <ThemeToggle />
    </ThemeProvider>
  );
}

describe('ThemeToggle', () => {
  afterEach(() => {
    document.documentElement.classList.remove('dark', 'light');
    localStorage.clear();
  });

  it('choosing dark stores the choice and adds the page class', async () => {
    const user = userEvent.setup();
    render(tree());

    await user.click(screen.getByRole('button', { name: 'Toggle theme' }));
    await user.click(screen.getByRole('menuitem', { name: 'Dark' }));

    expect(localStorage.getItem('nocap-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('choosing light after a stored dark theme removes the page class', async () => {
    localStorage.setItem('nocap-theme', 'dark');
    const user = userEvent.setup();
    render(tree());

    await user.click(screen.getByRole('button', { name: 'Toggle theme' }));
    await user.click(screen.getByRole('menuitem', { name: 'Light' }));

    expect(localStorage.getItem('nocap-theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('renders light dark and system entries in the dropdown', async () => {
    const user = userEvent.setup();
    render(tree());

    await user.click(screen.getByRole('button', { name: 'Toggle theme' }));

    expect(screen.getByRole('menuitem', { name: 'Light' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Dark' })).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'System' }),
    ).toBeInTheDocument();
  });
});
