import { describe, expect, it } from 'vitest';

import {
  detectProvider,
  detectTikTokVideoId,
  detectYouTubeVideoId,
  isPostEmbed,
  type VoteValue,
} from './index';

describe('shared vote values', () => {
  it('allows up down and clear', () => {
    const values: VoteValue[] = [1, -1, 0];
    expect(values).toEqual([1, -1, 0]);
  });
});

describe('youtube video id detection', () => {
  it('extracts the id from a youtu.be short link', () => {
    expect(detectYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    );
  });

  it('extracts the id from a watch query parameter', () => {
    expect(
      detectYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    ).toBe('dQw4w9WgXcQ');
  });

  it('extracts the id from a shorts path', () => {
    expect(
      detectYouTubeVideoId('https://www.youtube.com/shorts/x7f3kQm2PqA'),
    ).toBe('x7f3kQm2PqA');
  });

  it('extracts the id from a live path', () => {
    expect(
      detectYouTubeVideoId('https://www.youtube.com/live/aBcDeFgHiJk'),
    ).toBe('aBcDeFgHiJk');
  });

  it('extracts the id from a mobile watch url with offset', () => {
    expect(
      detectYouTubeVideoId('https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=4s'),
    ).toBe('dQw4w9WgXcQ');
  });

  it('rejects a stub query id on an unrelated host', () => {
    expect(detectYouTubeVideoId('https://example.com/watch?v=x')).toBeNull();
  });

  it('rejects a youtube shaped path on an unrelated host', () => {
    expect(
      detectYouTubeVideoId('https://notyoutube.com/dQw4w9WgXcQ'),
    ).toBeNull();
  });
});

describe('tiktok video id detection', () => {
  it('extracts the numeric id from a user video path', () => {
    expect(
      detectTikTokVideoId(
        'https://www.tiktok.com/@user/video/7301234567890123456',
      ),
    ).toBe('7301234567890123456');
  });

  it('rejects a profile path without a video segment', () => {
    expect(detectTikTokVideoId('https://www.tiktok.com/@user')).toBeNull();
  });
});

describe('provider detection', () => {
  it('routes youtube links to the youtube adapter', () => {
    expect(detectProvider('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube');
  });

  it('routes tiktok links to the tiktok adapter', () => {
    expect(
      detectProvider('https://www.tiktok.com/@user/video/7301234567890123456'),
    ).toBe('tiktok');
  });

  it('routes every other url to the link adapter', () => {
    expect(detectProvider('https://example.com/watch?v=x')).toBe('link');
  });
});

describe('embed shape guard', () => {
  it('accepts a complete youtube embed', () => {
    expect(
      isPostEmbed({
        provider: 'youtube',
        videoId: 'dQw4w9WgXcQ',
        title: 'Full Q4 footage',
        authorName: 'trackfan',
        thumbnailUrl: 'https://i.ytimg.com/hqdefault.jpg',
      }),
    ).toBe(true);
  });

  it('accepts a complete tiktok embed', () => {
    expect(
      isPostEmbed({
        provider: 'tiktok',
        videoId: '7301234567890123456',
        title: 'Referee clip',
        authorName: 'clipper',
        thumbnailUrl: 'https://p16-sign.tiktokcdn.jpg',
      }),
    ).toBe(true);
  });

  it('accepts a link embed with a null image', () => {
    expect(
      isPostEmbed({ provider: 'link', title: 'Poll page', image: null }),
    ).toBe(true);
  });

  it('rejects null and empty objects', () => {
    expect(isPostEmbed(null)).toBe(false);
    expect(isPostEmbed({})).toBe(false);
  });

  it('rejects an unknown provider tag', () => {
    expect(isPostEmbed({ provider: 'vimeo', videoId: 'abc' })).toBe(false);
  });

  it('rejects a provider tag without its payload fields', () => {
    expect(isPostEmbed({ provider: 'youtube' })).toBe(false);
  });
});
