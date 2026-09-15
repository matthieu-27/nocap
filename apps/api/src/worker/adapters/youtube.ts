import type { PostEmbed } from '@nocap/shared';

import { mediaEmbedFromOEmbed } from './oembed';

// Pure transform: shapes YouTube's oEmbed JSON into a YouTubeEmbed, or null
// when required fields are missing — the worker then marks the job failed and
// the post keeps its link-card fallback (spec §Embeds).
export function youtubeEmbedFromOEmbed(
  json: unknown,
  videoId: string,
): PostEmbed | null {
  return mediaEmbedFromOEmbed(json, videoId, 'youtube');
}
