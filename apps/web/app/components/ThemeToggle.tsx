import { Moon, Sun } from 'lucide-react';
import { Button } from './ui/button';

export function ThemeToggle(): React.ReactElement {
  function handleClick(): void {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('nocap-theme', isDark ? 'dark' : 'light');
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={handleClick}
    >
      <Sun className="size-4 dark:hidden" />
      <Moon className="hidden size-4 dark:block" />
    </Button>
  );
}
