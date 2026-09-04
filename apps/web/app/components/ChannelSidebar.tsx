import type { DomainDto } from '@nocap/shared';
import { channelHandle } from '@nocap/shared';
import { Link } from 'react-router';

import { cn } from '@/lib/utils';

import { ScrollArea } from './ui/scroll-area';

interface ChannelSidebarProps {
  domains: DomainDto[];
  activeSlug: string | null;
}

export function ChannelSidebar({
  domains,
  activeSlug,
}: ChannelSidebarProps): React.ReactElement {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-sidebar-border bg-sidebar text-sidebar-foreground">
      <p className="px-4 pt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Channels
      </p>
      <ScrollArea className="min-h-0 flex-1 px-2 py-2">
        <nav className="flex flex-col gap-0.5">
          {domains.map((domain) => (
            <Link
              key={domain.id}
              to={`/d/${domain.slug}`}
              aria-current={domain.slug === activeSlug ? 'page' : undefined}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm hover:bg-sidebar-accent',
                domain.slug === activeSlug && 'bg-sidebar-accent font-medium',
              )}
            >
              {channelHandle(domain.slug)}
            </Link>
          ))}
          {domains.length === 0 && (
            <p className="px-3 py-1.5 text-sm text-muted-foreground">
              No channels yet.
            </p>
          )}
        </nav>
      </ScrollArea>
      <div className="border-t border-sidebar-border p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Legal
        </p>
        <nav className="mt-2 flex flex-col gap-1.5 text-sm text-muted-foreground">
          <Link to="/terms" className="hover:text-sidebar-foreground">
            Terms of Service
          </Link>
          <Link to="/privacy" className="hover:text-sidebar-foreground">
            Privacy Policy
          </Link>
          <Link to="/contact" className="hover:text-sidebar-foreground">
            Contact
          </Link>
        </nav>
      </div>
    </aside>
  );
}
