import type { PostEmbed } from '@nocap/shared';

// Pure transform: shapes an oEmbed JSON payload into a YouTubeEmbed, or null
// when required fields are missing — the worker then marks the job failed and
// the post keeps its link-card fallback (spec §Embeds).
export function youtubeEmbedFromOEmbed(
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
    provider: 'youtube',
    videoId,
    title: payload.title,
    authorName: payload.author_name,
    thumbnailUrl: payload.thumbnail_url,
  };
}
