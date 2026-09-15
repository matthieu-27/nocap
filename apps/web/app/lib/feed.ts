import { type PostDto, toUrl } from '@nocap/shared';

import {
  FEED_PAGE_SIZE,
  type FeedSort,
  type FeedWindow,
  parseFeedOffset,
  parseFeedSort,
  parseFeedWindow,
} from '@/components/FeedControls';
import { apiFetch } from '@/lib/api';

export interface FeedPage {
  posts: PostDto[];
  sort: FeedSort;
  window: FeedWindow;
  offset: number;
}

// Shared by the home and channel loaders: parse the feed query params from
// the request URL (invalid values fall back to the API defaults) and fetch
// one page from the API, optionally scoped to a channel.
export async function loadFeedPage(
  request: Request,
  domainSlug?: string,
): Promise<FeedPage> {
  const url = toUrl(request.url);
  const searchParams = url?.searchParams ?? new URLSearchParams();
  const sort = parseFeedSort(searchParams.get('sort'));
  const window = parseFeedWindow(searchParams.get('window'));
  const offset = parseFeedOffset(searchParams.get('offset'));
  const query = new URLSearchParams({
    sort,
    window,
    limit: String(FEED_PAGE_SIZE),
    offset: String(offset),
  });
  if (domainSlug !== undefined) {
    query.set('domain', domainSlug);
  }
  const posts = await apiFetch<PostDto[]>(
    request,
    `/api/posts?${query.toString()}`,
  );
  return { posts, sort, window, offset };
}
