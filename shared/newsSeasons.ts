/**
 * Author: Claude Opus 5.5 Medium
 * Date: 27-November-2026
 * 27-Nov-2026 (Claude Opus 5.5 Medium): new. ARC Prize 2026 closed on 2 November 2026 and goes into storage until
 *          next year; Generalist Gaming is the contest the paper follows now.
 * PURPOSE: Which contests the newspaper puts in front and which it keeps in storage. One place answers both, so the
 *          front page's ticker, board and movers, the Inside box, the masthead countdown, the cards page order and
 *          the ARC Prize 2026 archive page (browser and server HTML alike) agree:
 *          - NEWS_CURRENT_COMPETITIONS: the contests whose live board, countdown and links lead the paper.
 *          - ARC_2026_ARCHIVE: the stored ARC Prize 2026 season: its address, its two boards, its card sets and the
 *            links that used to sit in the front page's Inside box. Nothing is deleted; every old address still works.
 *          The market feed (server/services/news/newsMarkets.ts) builds every board in NEWS_MARKET_COMPETITIONS: the
 *          current contests plus the stored ARC boards, which the wire desk and the leaderboard pages still read.
 * SRP/DRY check: Pass — competition identities stay in shared/kaggleCompetitions.ts and story order in
 *          shared/news.ts; this file only names which contests are current and which are stored, and their links.
 */
import { KAGGLE_COMPETITIONS, kaggleLeaderboardUrl } from './kaggleCompetitions';
import { NEWS_ARCHIVE, articleCompetitions, newsArticlePath, publishedCompetitionOrder, publishedStories, wirePath, type NewsArticle, type NewsCompetition, type NewsDispatch } from './news';

/** The contest the paper follows now; its board, countdown and links lead the front page. */
export const NEWS_LEAD_COMPETITION: NewsCompetition = 'generalist-gaming-agent';
/** Every contest the front page treats as live, lead first. */
export const NEWS_CURRENT_COMPETITIONS: NewsCompetition[] = [NEWS_LEAD_COMPETITION];

/** A link in an index box or the archive page; `external` links leave the single-page app (or the site). */
export interface NewsShelfLink { href: string; title: string; text: string; external?: boolean }

/** The ARC Prize 2026 season in storage: closed 2 November 2026, kept reachable until next year. */
export const ARC_2026_ARCHIVE = {
  path: '/news/archive/arc-prize-2026',
  heading: 'ARC Prize 2026 archive',
  shortText: 'final boards, medal race, game guides and every ARC story',
  description: 'ARC Prize 2026 on Kaggle closed on 2 November 2026. Its final public boards, the medal race, the game guides and every story the paper ran on it, kept in one place.',
  competitions: ['arc-3', 'arc-2'] as NewsCompetition[],
  /** Card sets issued for the season; the cards page files them under "2026 archive". The bare "2026" set is the original combined ARC set. */
  cardSetIds: ['2026', 'arc-3-2026', 'arc-2-2026'],
  cardHeading: '2026 archive',
} as const;

/** The board feed covers the current contests and the stored ARC boards (still read by the wire desk and leaderboard pages). */
export const NEWS_MARKET_COMPETITIONS: NewsCompetition[] = [...NEWS_CURRENT_COMPETITIONS, ...ARC_2026_ARCHIVE.competitions];

/** The final boards and season resources, as the archive page lists them. */
export const ARC_2026_LINKS: { heading: string; links: NewsShelfLink[] }[] = [
  { heading: 'The final boards', links: [
    { href: KAGGLE_COMPETITIONS['arc-3'].path, title: 'ARC-AGI-3 board', text: 'final public standings, every team, charts and history', external: true },
    { href: KAGGLE_COMPETITIONS['arc-2'].path, title: 'ARC-AGI-2 board', text: 'final public standings, medal race and history', external: true },
    { href: kaggleLeaderboardUrl(KAGGLE_COMPETITIONS['arc-3']), title: 'ARC-AGI-3 on Kaggle', text: 'the official leaderboard', external: true },
    { href: kaggleLeaderboardUrl(KAGGLE_COMPETITIONS['arc-2']), title: 'ARC-AGI-2 on Kaggle', text: 'the official leaderboard', external: true },
    { href: '/arc-leaderboards', title: 'All ARC leaderboards', text: 'both boards side by side', external: true },
  ] },
  { heading: 'The race', links: [
    { href: '/kaggle-leaderboard#medal-race', title: 'Medal race', text: 'every ARC-AGI-3 team against the medal lines', external: true },
    { href: '/kaggle-leaderboard#score-history', title: 'Score history', text: 'the leader and medal lines over time', external: true },
    { href: '/human-records.html', title: 'Human and AI records', text: 'action counts against AI scores', external: true },
  ] },
  { heading: 'The games and the people', links: [
    { href: '/arc3/games', title: 'Game guides', text: 'the 25 public ARC-AGI-3 games' },
    { href: '/hall-of-fame', title: 'Hall of Fame', text: 'illustrated cards of past ARC Prize winners', external: true },
    { href: '/news/cards', title: 'ARC Prize 2026 cards', text: 'the season’s competitor and team cards, under “2026 archive” at the end of the catalog' },
    { href: 'https://discord.gg/9b77dPAmcA', title: 'ARC Discord', text: 'the official community', external: true },
  ] },
];

/** Whether a story belongs to the stored ARC season (an edition may cover both ARC boards). */
export const isArc2026Story = (story: NewsArticle | NewsDispatch) =>
  ('edition' in story ? articleCompetitions(story) : [story.competition]).some(key => ARC_2026_ARCHIVE.competitions.includes(key));

/** Every ARC Prize 2026 story, newest first, in the same order as the story archive. */
export const arc2026Stories = (articles: NewsArticle[], dispatches: NewsDispatch[] = []) =>
  publishedStories(articles, dispatches).filter(isArc2026Story);

/** The newest published stories of one contest, newest first. */
export const contestStories = (articles: NewsArticle[], dispatches: NewsDispatch[] = [], competition: NewsCompetition = NEWS_LEAD_COMPETITION) =>
  publishedStories(articles, dispatches).filter(story => ('edition' in story ? articleCompetitions(story) : [story.competition]).includes(competition));

/** The contests whose stories lead the front page: the current contests first, then any other covered contest.
 *  A stored contest never takes a desk while anything else has been published (its stories live on the archive page
 *  and in the story archive); only a paper with nothing but stored coverage falls back to it, newest first. */
export function frontPageCompetitions(articles: NewsArticle[], dispatches: NewsDispatch[] = []): NewsCompetition[] {
  const published = publishedCompetitionOrder(articles, dispatches);
  const covered = published.filter(key => !ARC_2026_ARCHIVE.competitions.includes(key));
  if (!covered.length) return published;
  return [...NEWS_CURRENT_COMPETITIONS.filter(key => covered.includes(key)), ...covered.filter(key => !NEWS_CURRENT_COMPETITIONS.includes(key))];
}

/** The front page's Inside box: the lead contest's board, cards and stories, then the paper's own sections, then the ARC archive. */
export function insideLinks(articles: NewsArticle[], dispatches: NewsDispatch[] = []): NewsShelfLink[] {
  const lead = KAGGLE_COMPETITIONS[NEWS_LEAD_COMPETITION];
  const stories = contestStories(articles, dispatches);
  return [
    { href: kaggleLeaderboardUrl(lead), title: `${lead.label} board`, text: 'the public leaderboard on Kaggle', external: true },
    { href: '/news/cards', title: `${lead.label} cards`, text: 'the set and the Kaggleverse career cards' },
    ...(stories[0] ? [{ href: newsArticlePath(stories[0].id), title: `${lead.label} stories`, text: `${stories.length} so far; newest: ${stories[0].headline}` }] : []),
    { href: wirePath(), title: 'The wire', text: 'short dated stories from the boards' },
    { href: NEWS_ARCHIVE.path, title: NEWS_ARCHIVE.heading, text: 'every published story by date and competition' },
    { href: ARC_2026_ARCHIVE.path, title: ARC_2026_ARCHIVE.heading, text: ARC_2026_ARCHIVE.shortText },
  ];
}
