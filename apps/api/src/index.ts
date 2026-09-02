import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ServiceError } from './errors';
import { log } from './logger';
import healthRoutes from './routes/health.routes';

const app = new Hono();

app.route('/', healthRoutes);

app.onError((err, c) => {
  if (err instanceof ServiceError) {
    return c.json({ error: err.message }, err.status as ContentfulStatusCode);
  }
  log.error('unhandled error', { path: c.req.path, message: err.message });
  return c.json({ error: 'internal error' }, 500);
});

export default {
  port: Number(process.env.PORT ?? 3001),
  fetch: app.fetch,
  app,
};
export { app };
