import type { ReactElement } from 'react';
import { Link } from 'react-router';

import { Button } from './ui/button';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';

export type FeedSort = 'hot' | 'new' | 'top';
export type FeedWindow = 'day' | 'week' | 'all';

export const FEED_PAGE_SIZE = 25;

// URL search params are untrusted at the loader boundary; invalid values
// fall back to the API defaults instead of surfacing an error page.
export function parseFeedSort(raw: string | null): FeedSort {
  return raw === 'new' || raw === 'top' ? raw : 'hot';
}

export function parseFeedWindow(raw: string | null): FeedWindow {
  return raw === 'day' || raw === 'week' ? raw : 'all';
}

export function parseFeedOffset(raw: string | null): number {
  const parsed = Number(raw ?? 0);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

const SORT_TABS: ReadonlyArray<{ value: FeedSort; label: string }> = [
  { value: 'hot', label: 'Hot' },
  { value: 'new', label: 'New' },
  { value: 'top', label: 'Top' },
];

const WINDOW_CHIPS: ReadonlyArray<{ value: FeedWindow; label: string }> = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'all', label: 'All time' },
];

// Feed controls are pure navigation: every control is a Link, so sorting is
// SSR-able and there is no client state to hydrate wrong. Switching sort
// resets offset and drops the window param — an invisible day filter under
// Hot would be worse than a reset.
export function feedHref(
  sort: FeedSort,
  window: FeedWindow,
  offset = 0,
): string {
  const params = new URLSearchParams({ sort, offset: String(offset) });
  if (sort === 'top') {
    params.set('window', window);
  }
  return `?${params.toString()}`;
}

interface FeedControlsProps {
  sort: FeedSort;
  window: FeedWindow;
}

export function FeedControls({
  sort,
  window,
}: FeedControlsProps): ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tabs value={sort}>
        <TabsList>
          {SORT_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} asChild>
              <Link to={feedHref(tab.value, window)}>{tab.label}</Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {sort === 'top' &&
        WINDOW_CHIPS.map((chip) => (
          <Button
            key={chip.value}
            asChild
            size="sm"
            variant={chip.value === window ? 'secondary' : 'ghost'}
          >
            <Link to={feedHref('top', chip.value)}>{chip.label}</Link>
          </Button>
        ))}
    </div>
  );
}
