import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins/admin';
import { username } from 'better-auth/plugins/username';
import { db } from '../db/client';
import * as schema from '../db/schema';

const isProd = process.env.NODE_ENV === 'production';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: { enabled: true, minPasswordLength: 10 },
  plugins: [admin(), username()],
  trustedOrigins: [
    process.env.BETTER_AUTH_URL ?? 'http://localhost:3001',
    process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  ],
  advanced: {
    database: { generateId: 'serial' },
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: 'lax',
      // Plan 2 proxies /api same-origin over http in dev; Secure would drop the cookie.
      secure: isProd,
    },
  },
  rateLimit: {
    enabled: true,
    storage: 'database',
    customRules: { '/sign-in/email': { window: 900, max: 5 } },
  },
  session: { expiresIn: 60 * 60 * 24 * 30 },
});
