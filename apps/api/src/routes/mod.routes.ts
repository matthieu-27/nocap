import { Hono } from 'hono';
import { ServiceError } from '../errors';
import type { AuthEnv } from '../middleware/auth';
import { requireRole, requireUser } from '../middleware/auth';
import {
  listReports,
  resolveReport,
  setDomainLock,
} from '../services/report.service';

const mod = new Hono<AuthEnv>();

mod.get('/api/mod/reports', async (c) => {
  const user = requireUser(c);
  requireRole(user, ['mod', 'admin']);
  const status = c.req.query('status') ?? 'open';
  if (!['open', 'resolved', 'dismissed'].includes(status)) {
    throw new ServiceError(400, 'status must be open, resolved, or dismissed');
  }
  return c.json(await listReports(status as 'open' | 'resolved' | 'dismissed'));
});

mod.post('/api/mod/reports/:id/resolve', async (c) => {
  const user = requireUser(c);
  requireRole(user, ['mod', 'admin']);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) throw new ServiceError(400, 'invalid report id');
  const body = (await c.req.json()) as {
    decision: 'remove' | 'dismiss';
    reason: string;
  };
  if (!['remove', 'dismiss'].includes(body.decision)) {
    throw new ServiceError(400, 'decision must be remove or dismiss');
  }
  await resolveReport(user.id, id, body.decision, body.reason);
  return c.body(null, 204);
});

mod.post('/api/mod/domains/:slug/lock', async (c) => {
  const user = requireUser(c);
  requireRole(user, ['mod', 'admin']);
  const body = (await c.req.json()) as { locked: boolean; reason: string };
  await setDomainLock(user.id, c.req.param('slug'), body.locked, body.reason);
  return c.body(null, 204);
});

export default mod;
