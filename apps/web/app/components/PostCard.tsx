import {
  channelHandle,
  type PostDto,
  type ReportReason,
  userHandle,
  type VoteValue,
} from '@nocap/shared';
import { Flag, Share2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { timeAgo } from '@/lib/relative-time';
import { cn } from '@/lib/utils';

import { Embed } from './Embed';
import { ReportDialog } from './ReportDialog';
import { Badge, badgeVariants } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader } from './ui/card';
import { VoteArrows } from './VoteArrows';

interface PostCardProps {
  post: PostDto;
  onVote: (value: VoteValue) => void;
  onReport: (reason: ReportReason) => void;
  commentCount?: number | null;
}

export function PostCard({
  post,
  onVote,
  onReport,
  commentCount = null,
}: PostCardProps): ReactElement {
  const [reportOpen, setReportOpen] = useState(false);
  const now = new Date();

  async function handleShare(): Promise<void> {
    await navigator.clipboard.writeText(
      `${window.location.origin}/p/${post.id}`,
    );
    toast('Link copied');
  }

  return (
    <Card className="py-4">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/d/${post.domainSlug}`}
            className={cn(badgeVariants({ variant: 'secondary' }))}
          >
            {channelHandle(post.domainSlug)}
          </Link>
          <Badge variant="outline">{post.provider ?? 'link'}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex gap-3">
        <VoteArrows
          score={post.score}
          viewerVote={post.viewerVote ?? null}
          onVote={onVote}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Link
            to={`/p/${post.id}`}
            className="text-lg font-semibold leading-snug hover:underline"
          >
            {post.title}
          </Link>
          <p className="text-sm text-muted-foreground">
            <span aria-hidden="true" className="mr-1 font-semibold">
              ?
            </span>
            One question — Is this well-sourced?
          </p>
          <Embed post={post} compact />
          <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            <span>by {userHandle(post.author)}</span>
            <span aria-hidden="true">·</span>
            <span suppressHydrationWarning>{timeAgo(post.createdAt, now)}</span>
            {commentCount !== null && (
              <>
                <span aria-hidden="true">·</span>
                <span>💬 {commentCount} comments</span>
              </>
            )}
          </p>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleShare}
            >
              <Share2 data-icon="inline-start" />
              Share
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setReportOpen(true)}
            >
              <Flag data-icon="inline-start" />
              Report
            </Button>
          </div>
        </div>
      </CardContent>
      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        onSubmit={onReport}
      />
    </Card>
  );
}
