import { channelHandle, type DomainDto } from '@nocap/shared';
import type { ReactElement } from 'react';

import { FeedControls } from '@/components/FeedControls';
import { FeedList } from '@/components/FeedList';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';
import { type FeedPage, loadFeedPage } from '@/lib/feed';

import type { Route } from './+types/channel';

interface LoaderData extends FeedPage {
  domain: DomainDto;
}

export async function loader({
  request,
  params,
}: Route.LoaderArgs): Promise<LoaderData> {
  const domains = await apiFetch<DomainDto[]>(request, '/api/domains');
  const domain = domains.find((entry) => entry.slug === params.slug);
  if (!domain) {
    throw new Response('Channel not found', { status: 404 });
  }
  const feed = await loadFeedPage(request, domain.slug);
  return { domain, ...feed };
}

export default function ChannelRoute({
  loaderData,
}: Route.ComponentProps): ReactElement {
  const { domain, posts, sort, window, offset } = loaderData;
  return (
    <section className="flex flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{channelHandle(domain.slug)}</h1>
          {domain.isLocked && <Badge variant="outline">locked</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          {domain.name}
          {domain.description !== null && ` — ${domain.description}`}
        </p>
      </header>
      <FeedControls sort={sort} window={window} />
      <FeedList posts={posts} sort={sort} window={window} offset={offset} />
    </section>
  );
}
