import { describe, expect, it } from 'bun:test';
import { type PostRow, toDto } from './postProjection';

const row: PostRow = {
  id: 7,
  domainId: 2,
  domainSlug: 'sports',
  author: 'trackfan',
  title: 'Referee ignored three obvious fouls in Q4',
  body: null,
  url: 'https://youtu.be/dQw4w9WgXcQ',
  provider: null,
  embed: null,
  score: 47,
  createdAt: new Date('2026-09-11T10:00:00Z'),
};

describe('toDto', () => {
  it('maps a post row into the shared dto with iso createdAt', () => {
    expect(toDto(row)).toEqual({
      id: 7,
      domainId: 2,
      domainSlug: 'sports',
      author: 'trackfan',
      title: 'Referee ignored three obvious fouls in Q4',
      body: null,
      url: 'https://youtu.be/dQw4w9WgXcQ',
      provider: null,
      embed: null,
      score: 47,
      createdAt: '2026-09-11T10:00:00.000Z',
    });
  });

  it('passes provider and embed payload through untouched', () => {
    const embed = { provider: 'link', title: 't', image: null };
    const resolved: PostRow = {
      ...row,
      provider: 'link',
      embed,
    };
    expect(toDto(resolved).embed).toEqual(embed);
    expect(toDto(resolved).provider).toBe('link');
  });
});
