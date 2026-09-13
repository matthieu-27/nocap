import { type PostEmbed, toUrl } from '@nocap/shared';

// Matches og:title/og:image regardless of attribute order; the non-greedy
// content capture stops at the closing quote of the attribute value.
const OG_TITLE_RE =
  /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i;
const OG_TITLE_ALT_RE =
  /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:title["']/i;
const OG_IMAGE_RE =
  /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i;
const OG_IMAGE_ALT_RE =
  /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:image["']/i;

// Pure transform: pulls og:title/og:image out of a fetched page. The title
// falls back to the URL hostname so a link card always has a label; image is
// null when the tag is missing (web renders title-only card).
export function linkEmbedFromHtml(html: string, url: string): PostEmbed | null {
  const parsed = toUrl(url);
  if (parsed === null) return null;
  return {
    provider: 'link',
    title: decodeEntities(
      firstMatch(OG_TITLE_RE, html) ??
        firstMatch(OG_TITLE_ALT_RE, html) ??
        parsed.hostname,
    ),
    image:
      decodeEntities(
        firstMatch(OG_IMAGE_RE, html) ??
          firstMatch(OG_IMAGE_ALT_RE, html) ??
          '',
      ) || null,
  };
}

function firstMatch(regex: RegExp, html: string): string | null {
  return regex.exec(html)?.[1] ?? null;
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
};

function decodeEntities(value: string): string {
  return value.replace(
    /&(?:amp|lt|gt|quot|#39|apos);/g,
    (entity) => ENTITIES[entity] ?? entity,
  );
}
