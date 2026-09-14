import {
  type CommentDto,
  channelHandle,
  type PostDto,
  type ReportReason,
  userHandle,
  type VoteValue,
} from '@nocap/shared';
import { Flag, Share2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { Link, useRevalidator } from 'react-router';
import { toast } from 'sonner';

import { CommentComposer } from '@/components/CommentComposer';
import { CommentThread } from '@/components/CommentThread';
import { Embed } from '@/components/Embed';
import { ReportDialog } from '@/components/ReportDialog';
import { Badge, badgeVariants } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { VoteArrows } from '@/components/VoteArrows';
import { apiFetch } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { apiJson } from '@/lib/browser-api';
import { timeAgo } from '@/lib/relative-time';

import type { Route } from './+types/post';

interface LoaderData {
  post: PostDto;
  comments: CommentDto[];
}

export async function loader({
  request,
  params,
}: Route.LoaderArgs): Promise<LoaderData> {
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    throw new Response('Post not found', { status: 404 });
  }
  // Parallel + cookie-forwarded: viewerVote and the comment list arrive
  // server-rendered for the signed-in viewer (plan T9 step 1).
  const [post, comments] = await Promise.all([
    apiFetch<PostDto>(request, `/api/posts/${id}`),
    apiFetch<CommentDto[]>(request, `/api/posts/${id}/comments`),
  ]);
  return { post, comments };
}

// Frame 02 — full-height post hero with comments below. The page owns the
// vote/report/share wiring; hero voting applies optimistically like the
// feed (plan T6 contract), navigation refetches so state never drifts.
export default function PostRoute({
  loaderData,
}: Route.ComponentProps): ReactElement {
  const { post, comments } = loaderData;
  const revalidator = useRevalidator();
  const { data: session } = authClient.useSession();
  const signedIn = session?.user != null;

  const [vote, setVote] = useState<{
    score: number;
    viewerVote: VoteValue | null;
  } | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const now = new Date();

  const shownPost =
    vote === null
      ? post
      : { ...post, score: vote.score, viewerVote: vote.viewerVote };

  async function handleVote(value: VoteValue): Promise<void> {
    const current = shownPost.viewerVote ?? null;
    setVote({
      score: shownPost.score + (value - (current ?? 0)),
      viewerVote: value === 0 ? null : value,
    });
    try {
      const result = await apiJson<{ score: number }>(
        `/api/posts/${post.id}/vote`,
        { method: 'POST', body: JSON.stringify({ value }) },
      );
      setVote({ score: result.score, viewerVote: value === 0 ? null : value });
    } catch {
      setVote(null);
      toast.error('Vote failed');
    }
  }

  async function handleReport(reason: ReportReason): Promise<void> {
    try {
      await apiJson('/api/reports', {
        method: 'POST',
        body: JSON.stringify({ postId: post.id, reason }),
      });
      toast('Report filed');
    } catch {
      toast.error('Report failed');
    }
  }

  async function handleShare(): Promise<void> {
    await navigator.clipboard.writeText(
      `${window.location.origin}/p/${post.id}`,
    );
    toast('Link copied');
  }

  return (
    <section className="flex flex-col gap-4 p-4 md:p-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to={`/d/${post.domainSlug}`} />}>
              {channelHandle(post.domainSlug)}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{post.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/d/${post.domainSlug}`}
              className={badgeVariants({ variant: 'secondary' })}
            >
              {channelHandle(post.domainSlug)}
            </Link>
            <Badge variant="outline">{post.provider ?? 'link'}</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex gap-3">
          <VoteArrows
            score={shownPost.score}
            viewerVote={shownPost.viewerVote ?? null}
            onVote={(value) => {
              void handleVote(value);
            }}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h1 className="text-2xl font-bold leading-tight">{post.title}</h1>
            <p className="text-sm text-muted-foreground">
              <span aria-hidden="true" className="mr-1 font-semibold">
                ?
              </span>
              One question — Is this well-sourced?
            </p>
            <Embed post={shownPost} />
            {post.body !== null && (
              <div className="flex flex-col gap-2 text-sm leading-relaxed">
                {post.body.split(/\n{2,}/).map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            )}
            <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <span>by {userHandle(post.author)}</span>
              <span aria-hidden="true">·</span>
              <span suppressHydrationWarning>
                {timeAgo(post.createdAt, now)}
              </span>
              <span aria-hidden="true">·</span>
              <span>💬 {comments.length} comments</span>
            </p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  void handleShare();
                }}
              >
                <Share2 data-icon="inline-start" />
                Share
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setReportOpen(true);
                }}
              >
                <Flag data-icon="inline-start" />
                Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <CommentComposer
        postId={post.id}
        signedIn={signedIn}
        onCommented={() => {
          revalidator.revalidate();
        }}
      />
      <CommentThread
        postId={post.id}
        comments={comments}
        signedIn={signedIn}
        onThreadChanged={() => {
          revalidator.revalidate();
        }}
      />

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        onSubmit={(reason) => {
          void handleReport(reason);
        }}
      />
    </section>
  );
}
