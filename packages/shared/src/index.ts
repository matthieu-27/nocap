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
  viewerVote?: VoteValue | null;
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
  viewerVote?: VoteValue | null;
}

export interface ModPostDto extends PostDto {
  removedAt: string | null;
  openReports: number;
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
  swag: number;
  postSwag: number;
  commentSwag: number;
  createdAt: string;
  posts: PostDto[];
  commentCount: number;
}

// ── Embeds ─────────────────────────────────────────────────────────────────
// The worker stores one of these on posts.embed; the web narrows with
// isPostEmbed before rendering — PostDto.embed stays `unknown` at the wire
// boundary (spec §Embeds).

export interface YouTubeEmbed {
  provider: 'youtube';
  videoId: string;
  title: string;
  authorName: string;
  thumbnailUrl: string;
}

export interface TikTokEmbed {
  provider: 'tiktok';
  videoId: string;
  title: string;
  authorName: string;
  thumbnailUrl: string;
}

export interface LinkEmbed {
  provider: 'link';
  title: string;
  image: string | null;
}

export type PostEmbed = YouTubeEmbed | TikTokEmbed | LinkEmbed;

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
]);

// YouTube ids are exactly 11 chars of [A-Za-z0-9_-].
const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

const TIKTOK_HOSTS = new Set(['tiktok.com', 'www.tiktok.com', 'm.tiktok.com']);

function toUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** Extracts the 11-char id from watch?v=, /shorts/, /live/, and youtu.be links. */
export function detectYouTubeVideoId(url: string): string | null {
  const parsed = toUrl(url);
  if (!parsed) {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (host === 'youtu.be') {
    const id = parsed.pathname.split('/').find((part) => part !== '') ?? '';
    return YOUTUBE_ID_RE.test(id) ? id : null;
  }
  if (!YOUTUBE_HOSTS.has(host)) {
    return null;
  }
  const queryId = parsed.searchParams.get('v');
  if (queryId !== null && YOUTUBE_ID_RE.test(queryId)) {
    return queryId;
  }
  const pathMatch = parsed.pathname.match(
    /^\/(?:shorts|live)\/([A-Za-z0-9_-]{11})$/,
  );
  return pathMatch?.[1] ?? null;
}

/** Extracts the numeric id from tiktok.com/@user/video/<id> links. */
export function detectTikTokVideoId(url: string): string | null {
  const parsed = toUrl(url);
  if (!parsed) {
    return null;
  }
  if (!TIKTOK_HOSTS.has(parsed.hostname.toLowerCase())) {
    return null;
  }
  const pathMatch = parsed.pathname.match(/^\/@[^/]+\/video\/(\d{15,25})$/);
  return pathMatch?.[1] ?? null;
}

/** Maps a post URL to its worker adapter (spec §Embeds): the URL picks the
 * provider; everything else falls through to generic og-tags. */
export function detectProvider(url: string): ProviderId {
  if (detectYouTubeVideoId(url) !== null) return 'youtube';
  if (detectTikTokVideoId(url) !== null) return 'tiktok';
  return 'link';
}

/** Narrows PostDto.embed to a renderable variant. Validates the full payload
 * per provider — not just the tag — so a malformed row falls back to the
 * link card instead of crashing the card renderer. */
export function isPostEmbed(value: unknown): value is PostEmbed {
  if (!isRecord(value)) return false;
  const provider: unknown = value.provider;
  if (provider === 'youtube' || provider === 'tiktok') {
    return hasMediaEmbedFields(value);
  }
  if (provider === 'link') {
    return hasLinkEmbedFields(value);
  }
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasMediaEmbedFields(value: Record<string, unknown>): boolean {
  return (
    typeof value.videoId === 'string' &&
    typeof value.title === 'string' &&
    typeof value.authorName === 'string' &&
    typeof value.thumbnailUrl === 'string'
  );
}

function hasLinkEmbedFields(value: Record<string, unknown>): boolean {
  return (
    typeof value.title === 'string' &&
    (typeof value.image === 'string' || value.image === null)
  );
}
