import type { DomainDto } from '@nocap/shared';
import { Outlet, useLoaderData, useLocation, useNavigate } from 'react-router';

import { ChannelSidebar } from '@/components/ChannelSidebar';
import { Navbar } from '@/components/Navbar';
import { apiFetch } from '@/lib/api';
import { authClient, toSessionUser } from '@/lib/auth-client';

import type { Route } from './+types/_shell';

export async function loader({
  request,
}: Route.LoaderArgs): Promise<{ domains: DomainDto[] }> {
  try {
    const domains = await apiFetch<DomainDto[]>(request, '/api/domains');
    return { domains };
  } catch (error) {
    console.error('domains fetch failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return { domains: [] };
  }
}

export default function ShellRoute(): React.ReactElement {
  const { domains } = useLoaderData<typeof loader>();
  const { data: session } = authClient.useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const user = toSessionUser(session?.user ?? null);
  const activeSlug = channelSlugFromPath(location.pathname);

  async function handleSignOut(): Promise<void> {
    await authClient.signOut();
    navigate('/');
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={user} onSignOut={handleSignOut} />
      <div className="flex min-h-0 flex-1">
        <ChannelSidebar domains={domains} activeSlug={activeSlug} user={user} />
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function channelSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/d\/([a-z0-9-]+)/);
  return match?.[1] ?? null;
}
