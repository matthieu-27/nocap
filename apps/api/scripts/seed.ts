import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { rateLimit, user } from '../src/db/schema';
import { closeDb, resetDb } from '../src/db/testSetup';
import { app } from '../src/index';
import { log } from '../src/logger';
import { createComment } from '../src/services/comment.service';
import { createDomain } from '../src/services/domain.service';
import { createPost } from '../src/services/post.service';
import { createReport, setDomainLock } from '../src/services/report.service';
import { votePost } from '../src/services/vote.service';

// Dev-only fixture data: wipes every table and rebuilds an amusing but
// realistic slice of the claim lifecycle, including open reports a mod
// can resolve through the API (or the UI once it exists).
// The login form takes an email, so each user's "login" is the email
// prefix below. Passwords respect Better Auth's 10-character minimum.
const SEED_PASSWORD = 'dev-seed-password-123';

if (process.env.NODE_ENV === 'production') {
  throw new Error('seed.ts refuses to run in production (it truncates tables)');
}

interface SeedUser {
  username: string;
  email: string;
  password: string;
  role: 'user' | 'mod' | 'admin';
}

const USERS: SeedUser[] = [
  {
    username: 'admin',
    email: 'admin@nocap.dev',
    password: 'admin123ADMIN',
    role: 'admin',
  },
  {
    username: 'moderator',
    email: 'moderator@nocap.dev',
    password: 'Moderator123',
    role: 'mod',
  },
  {
    username: 'claimslayer',
    email: 'claimslayer@example.com',
    password: SEED_PASSWORD,
    role: 'user',
  },
  {
    username: 'peer_reviewer',
    email: 'peer_reviewer@example.com',
    password: SEED_PASSWORD,
    role: 'user',
  },
  {
    username: 'captain_skeptic',
    email: 'captain_skeptic@example.com',
    password: SEED_PASSWORD,
    role: 'user',
  },
  {
    username: 'lurking_larry',
    email: 'lurking_larry@example.com',
    password: SEED_PASSWORD,
    role: 'user',
  },
  {
    username: 'spammy_mcsell',
    email: 'spammy_mcsell@example.com',
    password: SEED_PASSWORD,
    role: 'user',
  },
];

async function signUp(seed: SeedUser): Promise<void> {
  // Better Auth rate-limits sign-ups with database storage; a seed batch
  // trips it, so clear the counter (dev script only, guarded above).
  await db.delete(rateLimit);
  const response = await app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: seed.username,
      name: seed.username,
      email: seed.email,
      password: seed.password,
    }),
  });
  if (response.status !== 200) {
    throw new Error(`signup failed for ${seed.username}: ${response.status}`);
  }
}

async function userId(username: string): Promise<number> {
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.username, username))
    .limit(1);
  const id = rows[0]?.id;
  if (!id) throw new Error(`user not found after signup: ${username}`);
  return id;
}

async function main(): Promise<void> {
  await resetDb();

  for (const seed of USERS) {
    await signUp(seed);
    if (seed.role !== 'user') {
      await db
        .update(user)
        .set({ role: seed.role })
        .where(eq(user.username, seed.username));
    }
  }
  const ids = {
    admin: await userId('admin'),
    mod: await userId('moderator'),
    claimslayer: await userId('claimslayer'),
    reviewer: await userId('peer_reviewer'),
    skeptic: await userId('captain_skeptic'),
    larry: await userId('lurking_larry'),
    spammer: await userId('spammy_mcsell'),
  };

  const domains = await Promise.all([
    createDomain(ids.skeptic, {
      slug: 'sports',
      name: 'Sports claims',
      description: 'World records, miracle plays, and athletic absurdity',
    }),
    createDomain(ids.reviewer, {
      slug: 'tech',
      name: 'Tech claims',
      description: 'Sentient toasters and goldfish-grade programmers',
    }),
    createDomain(ids.claimslayer, {
      slug: 'science',
      name: 'Science claims',
      description: 'Feline geniuses and other peer-reviewed miracles',
    }),
    createDomain(ids.larry, {
      slug: 'conspiracies',
      name: 'Conspiracy claims',
      description: 'Donut earth and the pigeon-drone industrial complex',
    }),
    createDomain(ids.spammer, {
      slug: 'crypto',
      name: 'Crypto claims',
      description: 'Locked pending review — the moon math was off',
    }),
  ]);

  const posts = {
    goldfish: await createPost(ids.claimslayer, 'tech', {
      title: 'My goldfish learned Rust and now refuses to write JavaScript',
      body: 'He memory-safe. He borrow-check my patience. Tank cam footage coming.',
      url: 'https://www.youtube.com/watch?v=goldfish-rust',
    }),
    mile: await createPost(ids.skeptic, 'sports', {
      title:
        'I ran a sub-4-minute mile backwards while juggling flaming torches',
      body: 'The flames were behind me the whole time, which is the fast direction.',
      url: 'https://example.com/backwards-mile',
    }),
    pigeon: await createPost(ids.larry, 'conspiracies', {
      title: 'Pigeons are government drones: the feather receipts (14 photos)',
      body: 'Ever seen a baby pigeon? Exactly. Case closed. Reopened. Closed again.',
      url: 'https://example.com/pigeon-dossiers',
    }),
    toaster: await createPost(ids.reviewer, 'tech', {
      title: 'This toaster runs Doom AND files my taxes',
      body: 'It declared the crumbs as dependents. The IRS has questions.',
      url: 'https://example.com/doom-toaster',
    }),
    donut: await createPost(ids.larry, 'conspiracies', {
      title: 'The Earth is a donut and NASA keeps eating the evidence',
      body: 'Why do you think they call it the hole in the ozone?',
      url: 'https://example.com/donut-earth',
    }),
    cat: await createPost(ids.claimslayer, 'science', {
      title: 'My cat scored 180 on an official IQ test (vet was speechless)',
      body: 'She refused to finish the test once she understood the scoring rubric.',
      url: 'https://example.com/cat-iq',
    }),
    // Reportable: spam
    spam: await createPost(ids.spammer, 'tech', {
      title: 'CHEAP CLOUD STORAGE 500TB FOR $1 - CLICK NOW LIMITED TIME',
      body: 'No cap! Send bank details to reserve your terabytes today!!',
      url: 'https://definitely-legit-storage.example.com/deal',
    }),
    // Reportable: off-domain content in sports
    offDomain: await createPost(ids.spammer, 'sports', {
      title: 'Why crypto will 100x by Friday (sports angle: I ran to the bank)',
      body: 'The only marathon that matters. Financial advice from a domain slug.',
      url: 'https://example.com/definitely-not-sports',
    }),
  };
  const goldfishPost = posts.goldfish;
  const milePost = posts.mile;
  const pigeonPost = posts.pigeon;
  const toasterPost = posts.toaster;
  const donutPost = posts.donut;
  const catPost = posts.cat;
  const spamPost = posts.spam;
  const offDomainPost = posts.offDomain;

  // Threaded discussion on the goldfish post: root -> reply -> reply-to-reply.
  const goldfishRoot = await createComment(ids.reviewer, goldfishPost.id, {
    body: 'Citation needed. Preferably notarized by the tank.',
  });
  const footageReply = await createComment(ids.claimslayer, goldfishPost.id, {
    body: 'The tank cam footage is rendering. He insists on release-mode.',
    parentId: goldfishRoot.id,
  });
  await createComment(ids.larry, goldfishPost.id, {
    body: 'source: trust me bro',
    parentId: footageReply.id,
  });
  await createComment(ids.skeptic, milePost.id, {
    body: 'Backwards AND juggling? I demand the torch budget receipts.',
  });
  await createComment(ids.reviewer, donutPost.id, {
    body: 'The donut model explains why time zones wrap around. Compelling.',
  });
  // Reportable: harassment
  const harassmentComment = await createComment(ids.skeptic, donutPost.id, {
    body: 'anyone who believes this has the brain of a wet sock',
  });
  // Reportable: personal info (fabricated)
  const personalInfoComment = await createComment(ids.spammer, donutPost.id, {
    body: 'larry lives at 123 Totally Fake Street, Springfield, call 555-0100',
  });
  const commentCount = 7;

  const votesPlan: [number, number, 1 | -1][] = [
    [ids.reviewer, goldfishPost.id, 1],
    [ids.skeptic, goldfishPost.id, 1],
    [ids.larry, goldfishPost.id, -1],
    [ids.claimslayer, milePost.id, 1],
    [ids.larry, milePost.id, 1],
    [ids.reviewer, pigeonPost.id, -1],
    [ids.skeptic, pigeonPost.id, -1],
    [ids.claimslayer, toasterPost.id, 1],
    [ids.larry, donutPost.id, 1],
    [ids.skeptic, catPost.id, 1],
  ];
  for (const [voter, postId, value] of votesPlan) {
    await votePost(voter, postId, value);
  }

  // Open reports for the mod queue: leave every one unresolved.
  await createReport(ids.reviewer, {
    postId: spamPost.id,
    reason: 'spam',
  });
  await createReport(ids.skeptic, {
    postId: offDomainPost.id,
    reason: 'off_domain',
  });
  await createReport(ids.larry, {
    commentId: harassmentComment.id,
    reason: 'harassment',
  });
  await createReport(ids.reviewer, {
    commentId: personalInfoComment.id,
    reason: 'personal_info',
  });

  // Lock a domain through the real mod path so a modAction row exists.
  await setDomainLock(ids.mod, 'crypto', true, 'moon math under review');

  log.info('seed complete', {
    users: USERS.length,
    domains: domains.length,
    posts: Object.keys(posts).length,
    comments: commentCount,
    openReports: 4,
    logins: {
      admin: 'admin@nocap.dev / admin123ADMIN',
      moderator: 'moderator@nocap.dev / Moderator123',
      others: `${USERS.length - 2} users @example.com / ${SEED_PASSWORD}`,
    },
  });
  await closeDb();
}

await main();
