import {
  channelHandle,
  type PostDto,
  type UserProfileDto,
  userHandle,
} from '@nocap/shared';
import type { ReactElement } from 'react';
import { Link } from 'react-router';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { badgeVariants } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiFetch } from '@/lib/api';
import { timeAgo } from '@/lib/relative-time';

import type { Route } from './+types/profile';

// Mon YYYY — the only date shape the profile shows (plan T11 step 2).
const memberSince = new Intl.DateTimeFormat('en', {
  month: 'short',
  year: 'numeric',
});

export async function loader({
  request,
  params,
}: Route.LoaderArgs): Promise<{ profile: UserProfileDto }> {
  const profile = await apiFetch<UserProfileDto>(
    request,
    `/api/users/${encodeURIComponent(params.username)}`,
  );
  return { profile };
}

function initials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

function ProfileHeader({ profile }: { profile: UserProfileDto }): ReactElement {
  return (
    <header className="flex items-center gap-3">
      <Avatar size="lg">
        <AvatarFallback>{initials(profile.username)}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">{userHandle(profile.username)}</h1>
        <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">
            {profile.swag} swag
          </span>
          <span aria-hidden="true">·</span>
          <span>{profile.posts.length} posts</span>
          <span aria-hidden="true">·</span>
          <span>{profile.commentCount} comments</span>
          <span aria-hidden="true">·</span>
          <span>
            member since {memberSince.format(new Date(profile.createdAt))}
          </span>
        </p>
      </div>
    </header>
  );
}

function ProfilePostRow({ post }: { post: PostDto }): ReactElement {
  return (
    <li className="flex items-center gap-2 text-sm">
      <Link
        to={`/d/${post.domainSlug}`}
        className={badgeVariants({ variant: 'secondary' })}
      >
        {channelHandle(post.domainSlug)}
      </Link>
      <Link
        to={`/p/${post.id}`}
        className="min-w-0 flex-1 truncate font-medium hover:underline"
      >
        {post.title}
      </Link>
      <span className="text-xs font-semibold text-primary tabular-nums">
        +{post.score}
      </span>
      <span className="text-xs text-muted-foreground" suppressHydrationWarning>
        · {timeAgo(post.createdAt, new Date())}
      </span>
    </li>
  );
}

function PostsPanel({ posts }: { posts: PostDto[] }): ReactElement {
  if (posts.length === 0) {
    return <p className="text-sm text-muted-foreground">No posts yet</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {posts.map((post) => (
        <ProfilePostRow key={post.id} post={post} />
      ))}
    </ul>
  );
}

// Comments are count-only in v1 — browsing arrives in v2 (frame 06 note).
function CommentsPanel({
  commentCount,
}: {
  commentCount: number;
}): ReactElement {
  return (
    <Card>
      <CardContent className="text-sm text-muted-foreground">
        {commentCount} comments across the site — comment browsing arrives in v2
      </CardContent>
    </Card>
  );
}

function SwagBreakdownCard({
  postSwag,
  commentSwag,
}: {
  postSwag: number;
  commentSwag: number;
}): ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Swag breakdown</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between">
          <span>post swag</span>
          <span className="font-semibold tabular-nums">{postSwag}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>comment swag</span>
          <span className="font-semibold tabular-nums">{commentSwag}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Recounted periodically from raw votes — self-healing
        </p>
      </CardContent>
    </Card>
  );
}

// Frame 06 — public profile: header stats, Posts|Comments tabs, swag
// breakdown card on the right.
export default function ProfileRoute({
  loaderData,
}: Route.ComponentProps): ReactElement {
  const { profile } = loaderData;

  return (
    <section className="flex flex-col gap-4 p-4 md:p-6">
      <ProfileHeader profile={profile} />
      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
        <Tabs defaultValue="posts">
          <TabsList>
            <TabsTrigger value="posts">Posts</TabsTrigger>
            <TabsTrigger value="comments">Comments</TabsTrigger>
          </TabsList>
          <TabsContent value="posts">
            <PostsPanel posts={profile.posts} />
          </TabsContent>
          <TabsContent value="comments">
            <CommentsPanel commentCount={profile.commentCount} />
          </TabsContent>
        </Tabs>
        <SwagBreakdownCard
          postSwag={profile.postSwag}
          commentSwag={profile.commentSwag}
        />
      </div>
    </section>
  );
}
