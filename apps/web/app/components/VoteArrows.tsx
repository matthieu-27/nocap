import type { VoteValue } from '@nocap/shared';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ReactElement } from 'react';

import { cn } from '@/lib/utils';

import { Button } from './ui/button';

interface VoteArrowsProps {
  score: number;
  viewerVote: VoteValue | null;
  onVote: (value: VoteValue) => void;
}

// Vote colors stay on semantic theme tokens for now: primary marks the
// active upvote, destructive the active downvote. The design frames call
// for fixed --up/--down tokens, but the tweakcn export in styles.css does
// not define them — swapping classes later is the only change needed.
export function VoteArrows({
  score,
  viewerVote,
  onVote,
}: VoteArrowsProps): ReactElement {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="upvote"
        aria-pressed={viewerVote === 1}
        onClick={() => onVote(viewerVote === 1 ? 0 : 1)}
        className={cn('size-7', viewerVote === 1 && 'text-primary')}
      >
        <ChevronUp />
      </Button>
      <span className="text-sm font-semibold tabular-nums">{score}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="downvote"
        aria-pressed={viewerVote === -1}
        onClick={() => onVote(viewerVote === -1 ? 0 : -1)}
        className={cn('size-7', viewerVote === -1 && 'text-destructive')}
      >
        <ChevronDown />
      </Button>
    </div>
  );
}
