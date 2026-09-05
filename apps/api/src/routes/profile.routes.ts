import { Hono } from 'hono';
import { getUserProfile } from '../services/profile.service';

const profile = new Hono();

profile.get('/api/users/:username', async (c) =>
  c.json(await getUserProfile(c.req.param('username'))),
);

export default profile;
