export type VoteValue = 1 | -1 | 0;

export interface DomainDto {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  isLocked: boolean;
}

export interface PostDto {
  id: number;
  domainId: number;
  domainSlug: string;
  author: string;
  title: string;
  body: string | null;
  url: string;
  provider: string | null;
  embed: unknown | null;
  score: number;
  createdAt: string;
}

export interface CommentDto {
  id: number;
  postId: number;
  parentId: number | null;
  depth: number;
  author: string;
  body: string;
  score: number;
  createdAt: string;
}

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'personal_info'
  | 'illegal'
  | 'off_domain';

export type ReportStatus = 'open' | 'resolved' | 'dismissed';

export interface SessionUser {
  id: number;
  username: string;
  role: 'user' | 'mod' | 'admin';
}

export function parseSessionRole(
  role: string | null | undefined,
): SessionUser['role'] {
  if (role === 'user' || role === 'mod' || role === 'admin') {
    return role;
  }
  return 'user';
}

export const SITE_NAME = 'NoCaP';
export const SITE_HANDLE = 'nocap';

// Registry of postable source types (spec §6). Provider adapters in the
// worker are separate modules keyed by these ids — adding a provider means
// one entry here plus one adapter, no form or schema changes.
export const SUPPORTED_PROVIDERS = ['youtube', 'tiktok', 'link'] as const;
export type ProviderId = (typeof SUPPORTED_PROVIDERS)[number];

export function channelHandle(slug: string): string {
  return `${SITE_HANDLE}/${slug}`;
}

export function userHandle(username: string): string {
  return `${SITE_HANDLE}/${username}`;
}

export interface UserProfileDto {
  username: string;
  role: string;
  karma: number;
  createdAt: string;
  posts: PostDto[];
  commentCount: number;
}
