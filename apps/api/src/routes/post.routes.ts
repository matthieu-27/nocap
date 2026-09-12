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

// Feed query params are untyped at the boundary; each parser owns one
// parameter's domain rules so the route handler stays flat (the 400 paths
// are pinned by apps/api/tests/post.test.ts).
function parseFeedSort(raw: string | undefined): 'hot' | 'new' | 'top' {
  const sort = raw ?? 'hot';
  if (sort !== 'hot' && sort !== 'new' && sort !== 'top') {
    throw new ServiceError(400, 'sort must be hot, new, or top');
  }
  return sort;
}

function parseFeedWindow(raw: string | undefined): 'day' | 'week' | 'all' {
  const window = raw ?? 'all';
  if (window !== 'day' && window !== 'week' && window !== 'all') {
    throw new ServiceError(400, 'window must be day, week, or all');
  }
  return window;
}

function parseFeedLimit(raw: string | undefined): number {
  const limit = Number(raw ?? 25);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ServiceError(400, 'limit must be an integer between 1 and 100');
  }
  return limit;
}

function parseFeedOffset(raw: string | undefined): number {
  const offset = Number(raw ?? 0);
  if (!Number.isInteger(offset) || offset < 0) {
    throw new ServiceError(400, 'offset must be a non-negative integer');
  }
  return offset;
}

post.get('/api/posts', async (c) => {
  return c.json(
    await listPosts({
      domainSlug: c.req.query('domain') || undefined,
      sort: parseFeedSort(c.req.query('sort')),
      window: parseFeedWindow(c.req.query('window')),
      limit: parseFeedLimit(c.req.query('limit')),
      offset: parseFeedOffset(c.req.query('offset')),
      viewerId: c.var.user?.id ?? null,
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
  return c.json(await getPost(id, c.var.user?.id ?? null));
});

// Hono route boilerplate (requireUser + id parse + body read) mirrors the
// comment routes; the repetition is the route table's legibility.
// fallow-ignore-next-line code-duplication
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
