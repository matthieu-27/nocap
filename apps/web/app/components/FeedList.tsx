import type { PostDto, ReportReason, VoteValue } from '@nocap/shared';
import { Megaphone } from 'lucide-react';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { ApiError } from '@/lib/api';
import { apiJson } from '@/lib/browser-api';

import {
  FEED_PAGE_SIZE,
  type FeedSort,
  type FeedWindow,
  feedHref,
} from './FeedControls';
import { PostCard } from './PostCard';
import { Button } from './ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from './ui/empty';

interface VoteOverride {
  score: number;
  viewerVote: VoteValue | null;
}

interface FeedListProps {
  posts: PostDto[];
  sort: FeedSort;
  window: FeedWindow;
  offset: number;
}

// The feed owns vote and report wiring so home and channel pages stay thin
// loaders. Votes apply optimistically over the loader data; navigation
// refetches, so overrides never outlive their page.
export function FeedList({
  posts,
  sort,
  window,
  offset,
}: FeedListProps): ReactElement {
  const [overrides, setOverrides] = useState<Map<number, VoteOverride>>(
    new Map(),
  );

  async function handleVote(
    postId: number,
    score: number,
    current: VoteValue | null,
    value: VoteValue,
  ): Promise<void> {
    const delta = value - (current ?? 0);
    const optimistic: VoteOverride = {
      score: score + delta,
      viewerVote: value === 0 ? null : value,
    };
    setOverrides((previous) => new Map(previous).set(postId, optimistic));
    try {
      const result = await apiJson<{ score: number }>(
        `/api/posts/${postId}/vote`,
        {
          method: 'POST',
          body: JSON.stringify({ value }),
        },
      );
      setOverrides((previous) =>
        new Map(previous).set(postId, {
          score: result.score,
          viewerVote: value === 0 ? null : value,
        }),
      );
    } catch (error) {
      setOverrides((previous) => {
        const next = new Map(previous);
        next.delete(postId);
        return next;
      });
      toast.error(error instanceof ApiError ? error.message : 'Vote failed');
    }
  }

  async function handleReport(
    postId: number,
    reason: ReportReason,
  ): Promise<void> {
    try {
      await apiJson('/api/reports', {
        method: 'POST',
        body: JSON.stringify({ postId, reason }),
      });
      toast('Report filed');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Report failed');
    }
  }

  if (posts.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Megaphone />
          </EmptyMedia>
          <EmptyTitle>No claims yet</EmptyTitle>
          <EmptyDescription>
            Be the first — post a well-sourced claim.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link to="/submit">Post a claim</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {posts.map((post) => {
        const override = overrides.get(post.id);
        const shown = override === undefined ? post : { ...post, ...override };
        return (
          <PostCard
            key={post.id}
            post={shown}
            onVote={(value) => {
              void handleVote(
                post.id,
                shown.score,
                shown.viewerVote ?? null,
                value,
              );
            }}
            onReport={(reason) => {
              void handleReport(post.id, reason);
            }}
          />
        );
      })}
      <nav
        className="flex items-center justify-between gap-2 pt-2"
        aria-label="feed pagination"
      >
        {offset > 0 ? (
          <Button asChild variant="outline" size="sm">
            <Link to={feedHref(sort, window, offset - FEED_PAGE_SIZE)}>
              Newer
            </Link>
          </Button>
        ) : (
          <span />
        )}
        {posts.length === FEED_PAGE_SIZE ? (
          <Button asChild variant="outline" size="sm">
            <Link to={feedHref(sort, window, offset + FEED_PAGE_SIZE)}>
              Load more
            </Link>
          </Button>
        ) : null}
      </nav>
    </div>
  );
}
