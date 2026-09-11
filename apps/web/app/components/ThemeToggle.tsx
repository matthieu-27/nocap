import { Moon, Sun } from 'lucide-react';
import type { ReactElement } from 'react';

import { Button } from './ui/button';

// Sun in light mode, moon in dark — the magicui animated-theme-toggler's
// visual contract, minus the view-transition machinery. The CSS swap needs
// no component state, so SSR and hydration have nothing to disagree about.
export function ThemeToggle(): ReactElement {
  function handleClick(): void {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('nocap-theme', isDark ? 'dark' : 'light');
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={handleClick}
    >
      <Sun className="dark:hidden" />
      <Moon className="hidden dark:block" />
    </Button>
  );
}
