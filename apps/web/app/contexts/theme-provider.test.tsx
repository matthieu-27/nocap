// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ThemeProvider, useTheme } from './theme-provider';

// Probe consumer: reads the context so tests can assert the provider's
// state without going through a UI component.
function ThemeProbe(): React.ReactElement {
  const { theme, setTheme } = useTheme();

  return (
    <button type="button" onClick={() => setTheme('dark')}>
      current: {theme}
    </button>
  );
}

function tree(storageKey?: string): React.ReactElement {
  return (
    <ThemeProvider defaultTheme="light" storageKey={storageKey}>
      <ThemeProbe />
    </ThemeProvider>
  );
}

describe('ThemeProvider', () => {
  afterEach(() => {
    document.documentElement.classList.remove('dark', 'light');
    localStorage.clear();
  });

  it('renders the default theme and ignores storage it cannot parse', () => {
    localStorage.setItem('nocap-theme', 'banana');
    render(tree());

    expect(screen.getByText('current: light')).toBeInTheDocument();
  });

  it('restores a stored theme into the context after mount', async () => {
    localStorage.setItem('nocap-theme', 'dark');
    const { findByText } = render(tree());

    expect(await findByText('current: dark')).toBeInTheDocument();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('setTheme persists the next theme to storage', () => {
    const { getByRole } = render(tree());

    fireEvent.click(getByRole('button', { name: /current: light/ }));

    expect(localStorage.getItem('nocap-theme')).toBe('dark');
    expect(screen.getByText('current: dark')).toBeInTheDocument();
  });
});
