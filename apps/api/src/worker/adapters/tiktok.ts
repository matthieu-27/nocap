import type { PostEmbed } from '@nocap/shared';

// Pure transform: mirrors the YouTube adapter against TikTok's oEmbed
// payload (same field names: title / author_name / thumbnail_url).
export function tiktokEmbedFromOEmbed(
  json: unknown,
  videoId: string,
): PostEmbed | null {
  if (typeof json !== 'object' || json === null) return null;
  const payload = json as Record<string, unknown>;
  if (
    typeof payload.title !== 'string' ||
    typeof payload.author_name !== 'string' ||
    typeof payload.thumbnail_url !== 'string'
  ) {
    return null;
  }
  return {
    provider: 'tiktok',
    videoId,
    title: payload.title,
    authorName: payload.author_name,
    thumbnailUrl: payload.thumbnail_url,
  };
}
