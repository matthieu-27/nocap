import type { ReportReason } from '@nocap/shared';
import { Hono } from 'hono';
import type { AuthEnv } from '../middleware/auth';
import { requireUser } from '../middleware/auth';
import { createReport } from '../services/report.service';

const report = new Hono<AuthEnv>();

report.post('/api/reports', async (c) => {
  const user = requireUser(c);
  const body = (await c.req.json()) as {
    postId?: number;
    commentId?: number;
    reason: ReportReason;
  };
  return c.json(await createReport(user.id, body), 201);
});

export default report;
