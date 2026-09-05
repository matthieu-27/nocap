import { Hono } from 'hono';
import type { AuthEnv } from '../middleware/auth';
import { requireUser } from '../middleware/auth';
import { createDomain, listDomains } from '../services/domain.service';

const domain = new Hono<AuthEnv>();

domain.get('/api/domains', async (c) => c.json(await listDomains()));

domain.post('/api/domains', async (c) => {
  const user = requireUser(c);
  const body = (await c.req.json()) as {
    slug: string;
    name: string;
    description?: string;
  };
  return c.json(await createDomain(user.id, body), 201);
});

export default domain;
