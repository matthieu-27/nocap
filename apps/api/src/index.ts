import { Hono } from 'hono';
import { ServiceError } from './errors';
import { auth } from './lib/auth';
import { log } from './logger';
import { sessionMiddleware } from './middleware/auth';
import commentRoutes from './routes/comment.routes';
import domainRoutes from './routes/domain.routes';
import healthRoutes from './routes/health.routes';
import modRoutes from './routes/mod.routes';
import postRoutes from './routes/post.routes';
import profileRoutes from './routes/profile.routes';
import reportRoutes from './routes/report.routes';

const app = new Hono();

app.use('*', sessionMiddleware);
app.route('/', healthRoutes);
app.route('/', domainRoutes);
app.route('/', postRoutes);
app.route('/', commentRoutes);
app.route('/', reportRoutes);
app.route('/', modRoutes);
app.route('/', profileRoutes);

app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw));

app.onError((err, c) => {
  if (err instanceof ServiceError) {
    return c.json({ error: err.message }, err.status);
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
