import type { CommentDto } from '@nocap/shared';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { ApiError } from '@/lib/api';
import { apiJson } from '@/lib/browser-api';

import { Button, buttonVariants } from './ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Spinner } from './ui/spinner';
import { Textarea } from './ui/textarea';

interface CommentComposerProps {
  postId: number;
  signedIn: boolean;
  parentId?: number | null;
  /** Called after a successful post so the page can revalidate its loader. */
  onCommented: () => void;
}

// Composing a reply reuses this component with parentId set; the placeholder
// and header shift so the reply context is visible (frame 02).
export function CommentComposer({
  postId,
  signedIn,
  parentId = null,
  onCommented,
}: CommentComposerProps): ReactElement {
  const [body, setBody] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const trimmed = body.trim();
    if (trimmed.length < 1 || trimmed.length > 4000) {
      toast.error('Comment must be 1-4000 characters');
      return;
    }
    setPending(true);
    try {
      await apiJson<CommentDto>(`/api/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: trimmed, parentId }),
      });
      setBody('');
      onCommented();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Comment failed');
    } finally {
      setPending(false);
    }
  }

  if (!signedIn) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Join the discussion</CardTitle>
        </CardHeader>
        <CardContent>
          <Link to="/login" className={buttonVariants()}>
            Log in to comment
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)}>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {parentId === null ? 'Add to the discussion' : 'Add your reply'}
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-2">
          <Textarea
            aria-label="comment body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Add to the discussion — cite what you checked"
            rows={parentId === null ? 4 : 2}
            disabled={pending}
          />
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            {parentId === null ? 'Comment' : 'Reply'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
