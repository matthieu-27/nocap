// @vitest-environment jsdom

import type { PostDto } from '@nocap/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Embed } from './Embed';

function makePost(overrides: Partial<PostDto> = {}): PostDto {
  return {
    id: 2077,
    domainId: 1,
    domainSlug: 'tech',
    author: 'sourcerer',
    title: 'Benchmark run goes sideways',
    body: null,
    url: 'https://example.com/article',
    provider: null,
    embed: null,
    score: 3,
    createdAt: new Date('2026-09-12T08:00:00Z').toISOString(),
    viewerVote: null,
    ...overrides,
  };
}

describe('Embed', () => {
  it('pending post renders hostname link card and no iframe', () => {
    const { container } = render(<Embed post={makePost()} />);
    expect(screen.getByText('example.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /example\.com/ })).toHaveAttribute(
      'href',
      'https://example.com/article',
    );
    expect(screen.getByText('Waiting for embed…')).toBeInTheDocument();
    expect(container.querySelector('iframe')).not.toBeInTheDocument();
  });

  it('youtube post renders click to load button and no iframe before click', () => {
    const { container } = render(
      <Embed
        post={makePost({
          url: 'https://youtu.be/dQw4w9WgXcQ',
          provider: 'youtube',
          embed: {
            provider: 'youtube',
            videoId: 'dQw4w9WgXcQ',
            title: 'Benchmark run goes sideways',
            authorName: 'nocap',
            thumbnailUrl: 'https://example.com/thumb.jpg',
          },
        })}
      />,
    );
    expect(
      screen.getByRole('button', { name: /load youtube embed/i }),
    ).toBeInTheDocument();
    expect(container.querySelector('iframe')).not.toBeInTheDocument();
  });

  it('youtube click swaps thumbnail for the nocookie iframe', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Embed
        post={makePost({
          url: 'https://youtu.be/dQw4w9WgXcQ',
          provider: 'youtube',
          embed: {
            provider: 'youtube',
            videoId: 'dQw4w9WgXcQ',
            title: 'Benchmark run goes sideways',
            authorName: 'nocap',
            thumbnailUrl: 'https://example.com/thumb.jpg',
          },
        })}
      />,
    );
    await user.click(
      screen.getByRole('button', { name: /load youtube embed/i }),
    );
    const iframe = container.querySelector('iframe');
    expect(iframe).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    );
    expect(iframe).toHaveAttribute('allowFullScreen');
    expect(
      screen.queryByRole('button', { name: /load youtube embed/i }),
    ).not.toBeInTheDocument();
  });

  it('tiktok click swaps thumbnail for the tiktok embed iframe', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Embed
        post={makePost({
          url: 'https://www.tiktok.com/@user/video/7301234567890123456',
          provider: 'tiktok',
          embed: {
            provider: 'tiktok',
            videoId: '7301234567890123456',
            title: 'Clip that proves the claim',
            authorName: 'nocap',
            thumbnailUrl: 'https://example.com/tiktok-thumb.jpg',
          },
        })}
      />,
    );
    expect(
      screen.getByRole('button', { name: /load tiktok embed/i }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: /load tiktok embed/i }),
    );
    expect(container.querySelector('iframe')).toHaveAttribute(
      'src',
      'https://www.tiktok.com/embed/v2/7301234567890123456',
    );
  });

  it('link post renders og title with hostname badge', () => {
    render(
      <Embed
        post={makePost({
          provider: 'link',
          embed: {
            provider: 'link',
            title: 'Study that debunks it',
            image: null,
          },
        })}
      />,
    );
    expect(screen.getByText('Study that debunks it')).toBeInTheDocument();
    expect(screen.getByText('example.com')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /study that debunks it/i }),
    ).toHaveAttribute('href', 'https://example.com/article');
  });

  it('malformed embed payload falls back to the link card', () => {
    const { container } = render(
      <Embed
        post={makePost({
          url: 'https://youtu.be/dQw4w9WgXcQ',
          provider: 'youtube',
          embed: { provider: 'youtube' },
        })}
      />,
    );
    expect(screen.getByText('youtu.be')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /load youtube embed/i }),
    ).not.toBeInTheDocument();
    expect(container.querySelector('iframe')).not.toBeInTheDocument();
  });
});
