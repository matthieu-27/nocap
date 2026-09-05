import type { VoteValue } from '@nocap/shared';
import { Hono } from 'hono';
import { ServiceError } from '../errors';
import type { AuthEnv } from '../middleware/auth';
import { requireUser } from '../middleware/auth';
import {
  createPost,
  getPost,
  listJobsDev,
  listPosts,
} from '../services/post.service';
import { votePost } from '../services/vote.service';

const post = new Hono<AuthEnv>();

post.get('/api/posts', async (c) => {
  const sortParam = c.req.query('sort') ?? 'hot';
  if (!['hot', 'new', 'top'].includes(sortParam)) {
    throw new ServiceError(400, 'sort must be hot, new, or top');
  }
  const windowParam = c.req.query('window') ?? 'all';
  if (!['day', 'week', 'all'].includes(windowParam)) {
    throw new ServiceError(400, 'window must be day, week, or all');
  }
  const limit = Math.min(Number(c.req.query('limit') ?? 25), 100);
  const offset = Number(c.req.query('offset') ?? 0);
  return c.json(
    await listPosts({
      domainSlug: c.req.query('domain') || undefined,
      sort: sortParam as 'hot' | 'new' | 'top',
      window: windowParam as 'day' | 'week' | 'all',
      limit,
      offset,
    }),
  );
});

post.post('/api/posts', async (c) => {
  const user = requireUser(c);
  const body = (await c.req.json()) as {
    domainSlug: string;
    title: string;
    body?: string;
    url: string;
  };
  return c.json(await createPost(user.id, body.domainSlug, body), 201);
});

post.get('/api/posts/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) throw new ServiceError(400, 'invalid post id');
  return c.json(await getPost(id));
});

post.post('/api/posts/:id/vote', async (c) => {
  const user = requireUser(c);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) throw new ServiceError(400, 'invalid post id');
  const body = (await c.req.json()) as { value: number };
  // JSON body is untyped at the boundary; votePost re-validates the domain
  return c.json(await votePost(user.id, id, body.value as VoteValue));
});

post.get('/api/dev/jobs', async (c) => c.json(await listJobsDev()));

export default post;
