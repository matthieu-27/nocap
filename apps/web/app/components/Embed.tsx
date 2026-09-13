import {
  isPostEmbed,
  type LinkEmbed,
  type PostDto,
  type TikTokEmbed,
  type YouTubeEmbed,
} from '@nocap/shared';
import { Play } from 'lucide-react';
import type { ReactElement } from 'react';
import { useState } from 'react';

import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface EmbedProps {
  post: PostDto;
  compact?: boolean;
}

// Renders the post's source slot by embed state (spec §Embeds): a resolved
// youtube/tiktok embed becomes click-to-load (GDPR — no third-party iframe
// byte loads before a user click), a resolved link embed becomes an og-tag
// card, and pending/failed posts keep the plain link card so they never
// block rendering.
export function Embed({ post, compact = false }: EmbedProps): ReactElement {
  const embed =
    post.provider !== null && isPostEmbed(post.embed) ? post.embed : null;
  if (embed === null) {
    return <PendingLinkCard post={post} compact={compact} />;
  }
  if (embed.provider === 'youtube' || embed.provider === 'tiktok') {
    return <ClickToLoadVideo embed={embed} />;
  }
  return <LinkEmbedCard post={post} embed={embed} />;
}

type MediaEmbed = YouTubeEmbed | TikTokEmbed;

// Thumbnail until clicked, then the provider iframe — youtube-nocookie for
// YouTube, tiktok's embed/v2 endpoint for TikTok.
function ClickToLoadVideo({ embed }: { embed: MediaEmbed }): ReactElement {
  const [loaded, setLoaded] = useState(false);

  if (loaded) {
    const src =
      embed.provider === 'youtube'
        ? `https://www.youtube-nocookie.com/embed/${embed.videoId}`
        : `https://www.tiktok.com/embed/v2/${embed.videoId}`;
    return (
      <AspectRatio ratio={16 / 9} className="overflow-hidden rounded-md border">
        <iframe
          src={src}
          title={embed.title}
          allow="encrypted-media; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </AspectRatio>
    );
  }

  return (
    <AspectRatio ratio={16 / 9} className="overflow-hidden rounded-md border">
      <img
        src={embed.thumbnailUrl}
        alt={embed.title}
        loading="lazy"
        className="h-full w-full object-cover"
      />
      <Button
        type="button"
        variant="secondary"
        onClick={() => setLoaded(true)}
        className="absolute inset-0 h-full w-full flex-col gap-2 bg-secondary/85 backdrop-blur-sm"
      >
        <Play aria-hidden="true" data-icon="inline-start" />
        <span>
          Load {embed.provider === 'youtube' ? 'YouTube' : 'TikTok'} embed —
          iframe only loads after your click (GDPR)
        </span>
      </Button>
    </AspectRatio>
  );
}

// Resolved generic link: og title + og image when the worker found them.
function LinkEmbedCard({
  post,
  embed,
}: {
  post: PostDto;
  embed: LinkEmbed;
}): ReactElement {
  return (
    <Card className="overflow-hidden py-0">
      <a
        href={post.url}
        target="_blank"
        rel="noreferrer"
        className="flex flex-col"
      >
        {embed.image !== null && (
          <AspectRatio ratio={16 / 9}>
            <img
              src={embed.image}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </AspectRatio>
        )}
        <CardContent className="flex flex-col items-start gap-1.5 px-3 pb-3">
          <Badge variant="secondary">{postHost(post.url)}</Badge>
          <span className="text-sm font-medium leading-snug">
            {embed.title}
          </span>
        </CardContent>
      </a>
    </Card>
  );
}

// Pending (worker has not drained the job) or failed (transform returned
// null) — same fallback shape either way, posts never block (spec §Embeds).
function PendingLinkCard({
  post,
  compact,
}: {
  post: PostDto;
  compact: boolean;
}): ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <a
        href={post.url}
        target="_blank"
        rel="noreferrer"
        className="flex flex-col gap-0.5 rounded-md border bg-muted/40 px-3 py-2 text-sm hover:bg-muted"
      >
        <span className="text-xs text-muted-foreground">
          {postHost(post.url)}
        </span>
        <span className="truncate text-foreground">{post.url}</span>
      </a>
      {!compact && (
        <p className="text-xs text-muted-foreground" role="status">
          Waiting for embed…
        </p>
      )}
    </div>
  );
}

function postHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    // Invalid urls fall back to the raw text — the API validates on write
    return url;
  }
}
