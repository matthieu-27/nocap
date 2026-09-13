import type { PostEmbed } from '@nocap/shared';

import { mediaEmbedFromOEmbed } from './oembed';

// Pure transform: mirrors the YouTube adapter against TikTok's oEmbed
// payload (same field names: title / author_name / thumbnail_url).
export function tiktokEmbedFromOEmbed(
  json: unknown,
  videoId: string,
): PostEmbed | null {
  return mediaEmbedFromOEmbed(json, videoId, 'tiktok');
}
