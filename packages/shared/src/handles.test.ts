import { describe, expect, it } from 'vitest';
import {
  channelHandle,
  SITE_NAME,
  SUPPORTED_PROVIDERS,
  userHandle,
} from './index';

describe('site handles', () => {
  it('channel handle prefixes slug with r/', () => {
    expect(channelHandle('politics')).toBe('r/politics');
  });

  it('user handle prefixes username with u/', () => {
    expect(userHandle('trackfan')).toBe('u/trackfan');
  });

  it('supported providers lists youtube, tiktok, and link for v1', () => {
    expect(SUPPORTED_PROVIDERS).toEqual(['youtube', 'tiktok', 'link']);
  });

  it('site name is NoCaP', () => {
    expect(SITE_NAME).toBe('NoCaP');
  });
});
