import { describe, expect, it } from 'vitest';
import {
  channelHandle,
  SITE_HANDLE,
  SITE_NAME,
  SUPPORTED_PROVIDERS,
  userHandle,
} from './index';

describe('site handles', () => {
  it('channel handle prefixes slug with the site handle', () => {
    expect(channelHandle('politics')).toBe('nocap/politics');
  });

  it('user handle prefixes username with the site handle', () => {
    expect(userHandle('trackfan')).toBe('nocap/trackfan');
  });

  it('supported providers lists youtube, tiktok, and link for v1', () => {
    expect(SUPPORTED_PROVIDERS).toEqual(['youtube', 'tiktok', 'link']);
  });

  it('site name is NoCaP and its handle is nocap', () => {
    expect(SITE_NAME).toBe('NoCaP');
    expect(SITE_HANDLE).toBe('nocap');
  });
});
