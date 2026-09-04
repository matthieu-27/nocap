import type { SessionUser } from '@nocap/shared';
import { AccountMenu } from './AccountMenu';
import { Logo } from './Logo';
import { SearchBar } from './SearchBar';
import { ThemeToggle } from './ThemeToggle';

interface NavbarProps {
  user: SessionUser | null;
  onSignOut: () => void;
}

export function Navbar({ user, onSignOut }: NavbarProps): React.ReactElement {
  return (
    <header className="flex items-center gap-4 border-b bg-card px-4 py-2.5">
      <Logo />
      <SearchBar />
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <AccountMenu user={user} onSignOut={onSignOut} />
      </div>
    </header>
  );
}
