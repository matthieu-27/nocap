import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins/admin';
import { username } from 'better-auth/plugins/username';
import { db } from '../db/client';
import * as schema from '../db/schema';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: { enabled: true },
  plugins: [admin(), username()],
  advanced: { database: { generateId: 'serial' } },
  session: { expiresIn: 60 * 60 * 24 * 30 },
});
