import type { SessionUser } from '@nocap/shared';
import { userHandle } from '@nocap/shared';
import { LogOut } from 'lucide-react';
import { Link } from 'react-router';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface AccountMenuProps {
  user: SessionUser | null;
  onSignOut: () => void;
}

export function AccountMenu({
  user,
  onSignOut,
}: AccountMenuProps): React.ReactElement {
  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" asChild>
          <Link to="/login">Log in</Link>
        </Button>
        <Button asChild>
          <Link to="/signup">Sign up</Link>
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Account menu">
          <Avatar className="size-8">
            <AvatarFallback>{user.username.slice(0, 2)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{userHandle(user.username)}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* Profile / Settings / Mod tools items arrive with Plan 3, when their
            routes exist. Items pointing at 404s are worse than fewer items. */}
        <DropdownMenuItem onSelect={onSignOut}>
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
