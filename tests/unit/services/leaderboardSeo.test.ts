/**
 * Author: Claude Sonnet 5.5
 * Date: 10-October-2026
 * PURPOSE: Verify that the ARC leaderboard pages get the live top of their boards in the text search
 *          crawlers read, dated by the saved snapshot; that team names are escaped; that unrelated
 *          pages, missing boards and a failing lookup leave the static copy untouched; and that the
 *          sitemap dates are the snapshot times.
 * SRP/DRY check: Pass — mocks only the saved-board digest; everything else is the real module.
 */
import { describe, expect, it, vi } from 'vitest';
import type { MarketBoard } from '../../../shared/newsMarkets';
import { ROUTE_META_TAGS } from '../../../shared/routes';

// A plain stand-in rather than vi.fn(): the mock library would otherwise treat the failing lookup as an unhandled rejection.
let lookups = 0;
let lookup: () => Promise<unknown> = async () => ({ generatedAt: 'x', boards: {} });
vi.mock('../../../server/services/news/newsMarkets', () => ({ latestMarkets: () => { lookups++; return lookup(); } }));
const returns = (payload: unknown) => { lookup = async () => payload; };
const fails = () => { lookup = async () => { throw new Error('database down'); }; };
const { leaderboardLastmods, standingsHtml, withLiveStandings } = await import('../../../server/services/seo/leaderboardSeo');

function board(competition: 'arc-3' | 'arc-2', fetched: string, names: string[]): MarketBoard {
  return {
    competition, label: competition === 'arc-3' ? 'ARC-AGI-3' : 'ARC-AGI-2', boardPath: competition === 'arc-3' ? '/kaggle-leaderboard' : '/kaggle-leaderboard/arc-2',
    fetched, teams: 321, medalRanks: { gold: 10, silver: 20, bronze: 30 },
    standings: names.map((name, index) => ({ rank: index + 1, teamId: String(index), name, score: 60.126 - index, submissions: 3, members: [], rankThen: null, scoreThen: null, isNew: false })),
  } as unknown as MarketBoard;
}
const names = Array.from({ length: 12 }, (_, index) => `Team ${index + 1}`);

describe('leaderboard pages for crawlers', () => {
  it('adds the top ten of each board, dated by its snapshot, and stamps the structured data', async () => {
    returns({ generatedAt: '2026-10-10T18:00:00Z', boards: {
      'arc-3': board('arc-3', '2026-10-10T17:30:00Z', names), 'arc-2': board('arc-2', '2026-10-10T17:00:00Z', names) } });
    const tags = ROUTE_META_TAGS['/arc-leaderboards'];
    const live = await withLiveStandings('/arc-leaderboards', tags);
    expect(live.bodyHtml).toContain('ARC-AGI-3 leaderboard: top 10 as of October 10, 2026');
    expect(live.bodyHtml).toContain('ARC-AGI-2 leaderboard: top 10 as of');
    expect(live.bodyHtml).toContain('<td>1</td><td>Team 1</td><td>60.13</td>');
    expect(live.bodyHtml).not.toContain('Team 11');
    expect(live.bodyHtml!.trimEnd().endsWith('</main>')).toBe(true);
    expect(live.bodyHtml!.match(/<h1[ >]/g)).toHaveLength(1);
    const page = (live.jsonLd!['@graph'] as Record<string, unknown>[]).find(node => node['@type'] === 'CollectionPage');
    expect(page?.dateModified).toBe('2026-10-10T17:30:00Z');
    expect(live.title).toBe(tags.title);
    expect(live.description).toBe(tags.description);
  });

  it('shows only its own board on a competition page', async () => {
    returns({ generatedAt: 'x', boards: { 'arc-3': board('arc-3', '2026-10-10T17:30:00Z', names), 'arc-2': board('arc-2', '2026-10-10T17:00:00Z', names) } });
    const live = await withLiveStandings('/kaggle-leaderboard/arc-2', ROUTE_META_TAGS['/kaggle-leaderboard/arc-2']);
    expect(live.bodyHtml).toContain('ARC-AGI-2 leaderboard: top 10');
    expect(live.bodyHtml).not.toContain('ARC-AGI-3 leaderboard: top 10');
  });

  it('escapes team names', () => {
    expect(standingsHtml(board('arc-3', '2026-10-10T17:30:00Z', ['<script>alert(1)</script> & co']))).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; co');
  });

  it('leaves other pages, missing boards and a failing lookup exactly as the static copy has them', async () => {
    const hub = ROUTE_META_TAGS['/arc-leaderboards'];
    const before = lookups;
    expect(await withLiveStandings('/about', ROUTE_META_TAGS['/about'])).toBe(ROUTE_META_TAGS['/about']);
    expect(lookups).toBe(before);
    returns({ generatedAt: 'x', boards: {} });
    expect(await withLiveStandings('/arc-leaderboards', hub)).toBe(hub);
    fails();
    expect(await withLiveStandings('/arc-leaderboards', hub)).toBe(hub);
    expect((await leaderboardLastmods()).size).toBe(0);
  });

  it('dates the sitemap entries by the saved snapshots, the hub by the newest', async () => {
    returns({ generatedAt: 'x', boards: { 'arc-3': board('arc-3', '2026-10-10T17:30:00Z', names), 'arc-2': board('arc-2', '2026-10-10T17:00:00Z', names) } });
    const lastmods = await leaderboardLastmods();
    expect(lastmods.get('https://arc.markbarney.net/kaggle-leaderboard')).toBe('2026-10-10T17:30:00Z');
    expect(lastmods.get('https://arc.markbarney.net/kaggle-leaderboard/arc-2')).toBe('2026-10-10T17:00:00Z');
    expect(lastmods.get('https://arc.markbarney.net/arc-leaderboards')).toBe('2026-10-10T17:30:00Z');
  });
});
