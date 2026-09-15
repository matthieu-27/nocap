import {
  type CommentDto,
  type ReportReason,
  userHandle,
  type VoteValue,
} from '@nocap/shared';
import { Reply } from 'lucide-react';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import { apiJson } from '@/lib/browser-api';
import { timeAgo } from '@/lib/relative-time';

import { CommentComposer } from './CommentComposer';
import { ReportDialog } from './ReportDialog';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Button } from './ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './ui/collapsible';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { VoteArrows } from './VoteArrows';

type CommentSort = 'best' | 'new';

interface CommentThreadProps {
  postId: number;
  comments: CommentDto[];
  signedIn: boolean;
  onThreadChanged: () => void;
}

// Vote overrides keyed by comment id, same optimistic pattern the feed uses
// for posts — navigation refetches, so overrides never outlive their page.
interface VoteOverride {
  score: number;
  viewerVote: VoteValue | null;
}

// The API returns a flat oldest-first list with depth (oldest-first anchors
// replies before parents render after — grouping rebuilds the tree here).
export function CommentThread({
  postId,
  comments,
  signedIn,
  onThreadChanged,
}: CommentThreadProps): ReactElement {
  const [sort, setSort] = useState<CommentSort>('best');
  const [overrides, setOverrides] = useState<Map<number, VoteOverride>>(
    new Map(),
  );
  const [replyToId, setReplyToId] = useState<number | null>(null);
  const [reportingId, setReportingId] = useState<number | null>(null);
  const now = new Date();

  const childrenByParent = new Map<number | null, CommentDto[]>();
  for (const comment of comments) {
    const bucket = childrenByParent.get(comment.parentId) ?? [];
    bucket.push(comment);
    childrenByParent.set(comment.parentId, bucket);
  }
  const roots = childrenByParent.get(null) ?? [];
  const visibleRoots =
    sort === 'best' ? [...roots].sort((a, b) => b.score - a.score) : roots;

  function applyOverride(commentId: number, override: VoteOverride): void {
    setOverrides((previous) => new Map(previous).set(commentId, override));
  }

  function dropOverride(commentId: number): void {
    setOverrides((previous) => {
      const next = new Map(previous);
      next.delete(commentId);
      return next;
    });
  }

  async function handleVote(
    commentId: number,
    score: number,
    current: VoteValue | null,
    value: VoteValue,
  ): Promise<void> {
    applyOverride(commentId, {
      score: score + (value - (current ?? 0)),
      viewerVote: value === 0 ? null : value,
    });
    try {
      const result = await fetchCommentVote(commentId, value);
      applyOverride(commentId, {
        score: result.score,
        viewerVote: value === 0 ? null : value,
      });
    } catch {
      dropOverride(commentId);
      toast.error('Vote failed');
    }
  }

  async function handleReport(
    commentId: number,
    reason: ReportReason,
  ): Promise<void> {
    try {
      await apiJson('/api/reports', {
        method: 'POST',
        body: JSON.stringify({ commentId, reason }),
      });
      toast('Report filed');
    } catch {
      toast.error('Report failed');
    }
  }

  return (
    <section className="flex flex-col gap-3" aria-label="comments">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{comments.length} comments</h2>
        <Tabs
          value={sort}
          onValueChange={(value) => {
            setSort(asCommentSort(value));
          }}
        >
          <TabsList>
            <TabsTrigger value="best">Best</TabsTrigger>
            <TabsTrigger value="new">New</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {visibleRoots.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No comments yet — add the first one.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {visibleRoots.map((comment) => (
            <CommentNode
              key={comment.id}
              comment={comment}
              childrenComments={childrenByParent.get(comment.id) ?? []}
              postId={postId}
              signedIn={signedIn}
              overrides={overrides}
              replyToId={replyToId}
              onToggleReply={setReplyToId}
              onReport={setReportingId}
              onVote={handleVote}
              onThreadChanged={onThreadChanged}
              now={now}
            />
          ))}
        </div>
      )}
      <ReportDialog
        open={reportingId !== null}
        onOpenChange={(open) => {
          if (!open) setReportingId(null);
        }}
        onSubmit={(reason) => {
          if (reportingId !== null) {
            void handleReport(reportingId, reason);
          }
        }}
      />
    </section>
  );
}

interface CommentNodeProps {
  comment: CommentDto;
  childrenComments: CommentDto[];
  postId: number;
  signedIn: boolean;
  overrides: Map<number, VoteOverride>;
  replyToId: number | null;
  onToggleReply: (commentId: number | null) => void;
  onReport: (commentId: number) => void;
  onVote: (
    commentId: number,
    score: number,
    current: VoteValue | null,
    value: VoteValue,
  ) => Promise<void>;
  onThreadChanged: () => void;
  now: Date;
}

function CommentNode({
  comment,
  childrenComments,
  postId,
  signedIn,
  overrides,
  replyToId,
  onToggleReply,
  onReport,
  onVote,
  onThreadChanged,
  now,
}: CommentNodeProps): ReactElement {
  const override = overrides.get(comment.id);
  const shown = override === undefined ? comment : { ...comment, ...override };
  const initials = comment.author.slice(0, 2).toUpperCase();
  return (
    <article className="flex gap-3">
      <VoteArrows
        score={shown.score}
        viewerVote={shown.viewerVote ?? null}
        onVote={(value) => {
          void onVote(comment.id, shown.score, shown.viewerVote ?? null, value);
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Avatar className="size-5">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span>{userHandle(comment.author)}</span>
          <span aria-hidden="true">·</span>
          <span suppressHydrationWarning>
            {timeAgo(comment.createdAt, now)}
          </span>
        </div>
        <p className="whitespace-pre-wrap text-sm">{comment.body}</p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => {
              onToggleReply(replyToId === comment.id ? null : comment.id);
            }}
          >
            <Reply data-icon="inline-start" />
            Reply
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => {
              onReport(comment.id);
            }}
          >
            Report
          </Button>
        </div>
        {replyToId === comment.id && (
          <CommentComposer
            postId={postId}
            signedIn={signedIn}
            parentId={comment.id}
            onCommented={() => {
              onToggleReply(null);
              onThreadChanged();
            }}
          />
        )}
        {childrenComments.length > 0 && (
          <Replies
            parent={comment}
            childrenComments={childrenComments}
            postId={postId}
            signedIn={signedIn}
            overrides={overrides}
            replyToId={replyToId}
            onToggleReply={onToggleReply}
            onReport={onReport}
            onVote={onVote}
            onThreadChanged={onThreadChanged}
            now={now}
          />
        )}
      </div>
    </article>
  );
}

// Replies collapse under their parent; the thread line keeps depth readable
// without nested indentation wrappers (frame 02).
function Replies({
  parent,
  childrenComments,
  ...nodeProps
}: Omit<CommentNodeProps, 'comment'> & {
  parent: CommentDto;
  childrenComments: CommentDto[];
}): ReactElement {
  const count = childrenComments.length;
  return (
    <Collapsible defaultOpen className="mt-1">
      <CollapsibleTrigger
        render={<Button type="button" variant="ghost" size="xs" />}
      >
        {count} {count === 1 ? 'reply' : 'replies'}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 flex flex-col gap-4 border-l pl-4">
          {childrenComments.map((child) => (
            <CommentNode
              key={child.id}
              comment={child}
              childrenComments={[]}
              postId={nodeProps.postId}
              signedIn={nodeProps.signedIn}
              overrides={nodeProps.overrides}
              replyToId={nodeProps.replyToId}
              onToggleReply={nodeProps.onToggleReply}
              onReport={nodeProps.onReport}
              onVote={nodeProps.onVote}
              onThreadChanged={nodeProps.onThreadChanged}
              now={nodeProps.now}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function asCommentSort(value: string): CommentSort {
  return value === 'new' ? 'new' : 'best';
}

async function fetchCommentVote(
  commentId: number,
  value: VoteValue,
): Promise<{ score: number }> {
  return apiJson<{ score: number }>(`/api/comments/${commentId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ value }),
  });
}
