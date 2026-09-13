import type { PostEmbed, ProviderId } from '@nocap/shared';

// Shared body of the two oEmbed adapters: YouTube and TikTok payloads use
// the same field names (title / author_name / thumbnail_url), so the shape
// validation lives here and each provider file stays a thin entry point.
export function mediaEmbedFromOEmbed(
  json: unknown,
  videoId: string,
  provider: Extract<ProviderId, 'youtube' | 'tiktok'>,
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
    provider,
    videoId,
    title: payload.title,
    authorName: payload.author_name,
    thumbnailUrl: payload.thumbnail_url,
  };
}
