/**
 * Author: Claude Sonnet 5.5
 * Date: 10-October-2026
 * PURPOSE: Puts the live leaderboards into what search crawlers read. The ARC leaderboard pages
 *          (the /arc-leaderboards hub and the two Kaggle boards) are React apps whose static
 *          crawler copy had no standings in it; this adds the current top of each board, dated by
 *          the saved snapshot, and stamps the structured data with that time as dateModified.
 *          It also supplies the snapshot times that give those pages a real sitemap lastmod.
 *          Everything comes from the saved board digest (news/newsMarkets.ts, cached for a minute).
 *          A board that was never saved, a database that is down or a slow lookup leaves the page
 *          exactly as the static route copy has it: nothing is invented and nothing waits long.
 * SRP/DRY check: Pass — read-only enrichment of page metadata. Route copy stays in shared/routes.ts,
 *          the digest in shared/newsMarkets.ts, serving in middleware/metaTagInjector.ts.
 */
import type { RouteMetaTags } from '../../../shared/routes';
import type { NewsCompetition } from '../../../shared/news';
import { newsDate } from '../../../shared/news';
import type { MarketBoard } from '../../../shared/newsMarkets';
import { escapeHtml as esc, SITE_ORIGIN } from '../../../shared/seo';
import { latestMarkets } from '../news/newsMarkets';
import { logger } from '../../utils/logger';

/** Which saved boards each leaderboard page shows. */
const BOARD_PAGES: Record<string, NewsCompetition[]> = {
  '/arc-leaderboards': ['arc-3', 'arc-2'],
  '/kaggle-leaderboard': ['arc-3'],
  '/kaggle-leaderboard/arc-2': ['arc-2'],
};
const TOP = 10;
/** A page never waits longer than this for the database. */
const LOOKUP_MS = 2500;

/** The saved boards for these contests, or none when they cannot be read in time. */
async function liveBoards(competitions: NewsCompetition[]): Promise<MarketBoard[]> {
  let timer: NodeJS.Timeout | undefined;
  try {
    const payload = await Promise.race([
      latestMarkets(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('board lookup timed out')), LOOKUP_MS); }),
    ]);
    return competitions.flatMap(competition => payload.boards[competition] ?? []);
  } catch (error) {
    logger.warn(`leaderboard seo: serving static copy - ${error instanceof Error ? error.message : String(error)}`, 'seo');
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** The top of one board as a plain table, dated by the snapshot it came from. */
export function standingsHtml(board: MarketBoard): string {
  const rows = board.standings.slice(0, TOP).map(row => `<tr><td>${row.rank}</td><td>${esc(row.name)}</td><td>${row.score.toFixed(2)}</td></tr>`).join('');
  const { gold, silver, bronze } = board.medalRanks;
  return `<section><h2>${esc(board.label)} leaderboard: top ${Math.min(TOP, board.standings.length)} as of ${esc(newsDate(board.fetched, true))}</h2>`
    + `<table><thead><tr><th>Rank</th><th>Team</th><th>Score</th></tr></thead><tbody>${rows}</tbody></table>`
    + `<p>${board.teams} teams are on the public board. Gold, silver and bronze lines sit at ranks ${gold}, ${silver} and ${bronze}. `
    + `<a href="${esc(board.boardPath)}">Full ${esc(board.label)} leaderboard</a>.</p></section>`;
}

/** The page's structured data, with the newest snapshot time as the page's dateModified. */
function stampModified(jsonLd: Record<string, unknown>, modified: string): Record<string, unknown> {
  const graph = jsonLd['@graph'];
  if (!Array.isArray(graph)) return jsonLd;
  return { ...jsonLd, '@graph': graph.map(node => node['@type'] === 'WebPage' || node['@type'] === 'CollectionPage' ? { ...node, dateModified: modified } : node) };
}

/** A leaderboard page's metadata with the live top of its board(s) in the crawler text; other routes pass through. */
export async function withLiveStandings(route: string, tags: RouteMetaTags): Promise<RouteMetaTags> {
  const competitions = BOARD_PAGES[route];
  if (!competitions || !tags.bodyHtml) return tags;
  const boards = await liveBoards(competitions);
  const close = tags.bodyHtml.lastIndexOf('</main>');
  if (!boards.length || close < 0) return tags;
  const modified = boards.map(board => board.fetched).sort().at(-1)!;
  return {
    ...tags,
    bodyHtml: `${tags.bodyHtml.slice(0, close)}${boards.map(standingsHtml).join('')}${tags.bodyHtml.slice(close)}`,
    ...(tags.jsonLd ? { jsonLd: stampModified(tags.jsonLd, modified) } : {}),
  };
}

/** Real change times for the sitemap: the latest saved snapshot behind each leaderboard page. */
export async function leaderboardLastmods(): Promise<Map<string, string>> {
  const boards = await liveBoards(['arc-3', 'arc-2']);
  const lastmods = new Map(boards.map(board => [`${SITE_ORIGIN}${board.boardPath}`, board.fetched] as const));
  if (boards.length) lastmods.set(`${SITE_ORIGIN}/arc-leaderboards`, boards.map(board => board.fetched).sort().at(-1)!);
  return lastmods;
}
