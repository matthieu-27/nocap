import type { VoteValue } from '@nocap/shared';
import { Hono } from 'hono';
import { ServiceError } from '../errors';
import type { AuthEnv } from '../middleware/auth';
import { requireUser } from '../middleware/auth';
import {
  createComment,
  listComments,
  voteComment,
} from '../services/comment.service';

const comment = new Hono<AuthEnv>();

comment.get('/api/posts/:id/comments', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) throw new ServiceError(400, 'invalid post id');
  return c.json(await listComments(id));
});

comment.post('/api/posts/:id/comments', async (c) => {
  const user = requireUser(c);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) throw new ServiceError(400, 'invalid post id');
  const body = (await c.req.json()) as { body: string; parentId?: number };
  return c.json(await createComment(user.id, id, body), 201);
});

comment.post('/api/comments/:id/vote', async (c) => {
  const user = requireUser(c);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) throw new ServiceError(400, 'invalid comment id');
  const body = (await c.req.json()) as { value: number };
  // JSON body is untyped at the boundary; voteComment re-validates the domain
  return c.json(await voteComment(user.id, id, body.value as VoteValue));
});

export default comment;
