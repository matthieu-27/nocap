import type { ReactElement } from 'react';

import { FeedControls } from '@/components/FeedControls';
import { FeedList } from '@/components/FeedList';
import { type FeedPage, loadFeedPage } from '@/lib/feed';

import type { Route } from './+types/home';

export async function loader({ request }: Route.LoaderArgs): Promise<FeedPage> {
  return loadFeedPage(request);
}

export default function HomeRoute({
  loaderData,
}: Route.ComponentProps): ReactElement {
  return (
    <section className="flex flex-col gap-4 p-4 md:p-6">
      <FeedControls sort={loaderData.sort} window={loaderData.window} />
      <FeedList
        posts={loaderData.posts}
        sort={loaderData.sort}
        window={loaderData.window}
        offset={loaderData.offset}
      />
    </section>
  );
}
