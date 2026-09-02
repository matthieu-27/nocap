import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 32 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 8 }).notNull().default('user'),
  karma: integer('karma').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex('sessions_token_hash_idx').on(table.tokenHash)],
);

export const domains = pgTable('domains', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 32 }).notNull().unique(),
  name: varchar('name', { length: 64 }).notNull(),
  description: text('description'),
  isLocked: boolean('is_locked').notNull().default(false),
  createdBy: integer('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const posts = pgTable(
  'posts',
  {
    id: serial('id').primaryKey(),
    domainId: integer('domain_id')
      .notNull()
      .references(() => domains.id),
    authorId: integer('author_id')
      .notNull()
      .references(() => users.id),
    title: varchar('title', { length: 300 }).notNull(),
    body: text('body'),
    url: text('url').notNull(),
    provider: varchar('provider', { length: 32 }),
    embed: jsonb('embed'),
    score: integer('score').notNull().default(0),
    hotRank: doublePrecision('hot_rank').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('posts_domain_idx').on(table.domainId),
    index('posts_hot_idx').on(table.hotRank),
  ],
);

export const votes = pgTable(
  'votes',
  {
    postId: integer('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    value: smallint('value').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('votes_post_user_idx').on(table.postId, table.userId),
  ],
);

export const comments = pgTable(
  'comments',
  {
    id: serial('id').primaryKey(),
    postId: integer('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    authorId: integer('author_id')
      .notNull()
      .references(() => users.id),
    parentId: integer('parent_id'),
    body: text('body').notNull(),
    score: integer('score').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [index('comments_post_idx').on(table.postId)],
);

export const commentVotes = pgTable(
  'comment_votes',
  {
    commentId: integer('comment_id')
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    value: smallint('value').notNull(),
  },
  (table) => [
    uniqueIndex('comment_votes_idx').on(table.commentId, table.userId),
  ],
);

export const reports = pgTable('reports', {
  id: serial('id').primaryKey(),
  reporterId: integer('reporter_id')
    .notNull()
    .references(() => users.id),
  postId: integer('post_id').references(() => posts.id, {
    onDelete: 'cascade',
  }),
  commentId: integer('comment_id').references(() => comments.id, {
    onDelete: 'cascade',
  }),
  reason: varchar('reason', { length: 32 }).notNull(),
  status: varchar('status', { length: 16 }).notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const modActions = pgTable('mod_actions', {
  id: serial('id').primaryKey(),
  modId: integer('mod_id')
    .notNull()
    .references(() => users.id),
  action: varchar('action', { length: 32 }).notNull(),
  targetPostId: integer('target_post_id').references(() => posts.id),
  targetUserId: integer('target_user_id').references(() => users.id),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const jobs = pgTable('jobs', {
  id: serial('id').primaryKey(),
  type: varchar('type', { length: 32 }).notNull(),
  payload: jsonb('payload').notNull(),
  status: varchar('status', { length: 16 }).notNull().default('pending'),
  runAt: timestamp('run_at', { withTimezone: true }).notNull().defaultNow(),
});
