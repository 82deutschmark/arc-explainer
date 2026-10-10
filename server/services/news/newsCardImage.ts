/**
 * Author: Claude Opus 5.5 (Bubba)
 * Date: 08-October-2026
 * PURPOSE: Renders The ARC Daily's 1200x630 link-preview cards: one per article (masthead,
 *          competition and edition, headline, top three of that edition's own box score)
 *          and one section card for /news and the competitor notebook (the latest headline
 *          from each competition). Served by server/routes/news.ts; the URLs and alt text
 *          come from shared/news.ts so the meta tags, JSON-LD and React pages agree.
 *
 *          WHY SATORI. The game cards (arc3GameOgImageService.ts) carry no text because
 *          sharp draws SVG text through librsvg, which needs system fonts, and the Alpine
 *          container has none. A newspaper card is mostly text, so satori lays it out with
 *          the committed OFL IBM Plex fonts in server/assets/fonts/news-card and emits every
 *          glyph as a vector path. sharp then only rasterizes paths: same output on a Mac
 *          and in the container, no fonts installed, no native module added.
 *
 *          09-Oct-2026 (Claude Opus 5.5): editions print as Early and Late (NEWS_CARD_DESIGN 3).
 *
 *          GLYPHS. The fonts cover Latin script. Team names can be emoji or Japanese; those
 *          characters are dropped from the card only (never from the article), and a name
 *          with nothing left prints as its Kaggle team number.
 *
 *          CACHING. A plain Map, like the game cards: the inputs are committed files that
 *          change only on redeploy. Article keys include the content version, so a corrected
 *          article renders a fresh card under a fresh URL.
 * SRP/DRY check: Pass — image composition only. Article data comes from newsStore.ts, wording
 *          and card URLs from shared/news.ts. Checked ogImageService.ts and
 *          arc3GameOgImageService.ts first: both draw grids from puzzle/game data and
 *          deliberately draw no text, so neither could be reused for a text card.
 */
import fs from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import sharp from 'sharp';
import {
  type NewsArticle, type NewsStat, NEWS_CARD_HEIGHT, NEWS_CARD_WIDTH, NEWS_NAME,
  articleCardVersion, cardStandings, competitionName, editionLabel, newsDate,
} from '../../../shared/news';
import { getNewsIndex } from './newsStore';
import { logger } from '../../utils/logger';

/** Same palette as client/src/components/news/news.css, so a card looks like the page. */
const PAPER = '#f7f2e8';
const INK = '#24221e';
const RED = '#922f25';
const RULE = '#b8afa0';
const MUTED = '#645d53';
const SERIF = 'IBM Plex Serif';
const SANS = 'IBM Plex Sans Condensed';
const FONT_DIRECTORY = path.join(process.cwd(), 'server', 'assets', 'fonts', 'news-card');

type Node = { type: string; props: Record<string, unknown> };
type Style = Record<string, string | number>;
const box = (style: Style, ...children: (Node | string | null | false)[]): Node =>
  ({ type: 'div', props: { style: { display: 'flex', ...style }, children: children.filter(child => child !== null && child !== false) } });

let fonts: Parameters<typeof satori>[1]['fonts'] | undefined;
function loadFonts() {
  const read = (file: string) => fs.readFileSync(path.join(FONT_DIRECTORY, file));
  fonts ??= [
    { name: SERIF, data: read('IBMPlexSerif-Bold.ttf'), weight: 700, style: 'normal' },
    { name: SERIF, data: read('IBMPlexSerif-Regular.ttf'), weight: 400, style: 'normal' },
    { name: SANS, data: read('IBMPlexSansCondensed-Bold.ttf'), weight: 700, style: 'normal' },
    { name: SANS, data: read('IBMPlexSansCondensed-Medium.ttf'), weight: 500, style: 'normal' },
  ];
  return fonts;
}

/** Latin, Latin-1 punctuation and typographic quotes/dashes: what the committed fonts draw. */
export function cardText(value: string): string {
  return value.replace(/[^\u0020-\u024F\u2013\u2014\u2018-\u201F\u2026\u00B7]/gu, '').replace(/\s+/g, ' ').trim();
}
const teamName = (stat: NewsStat) => cardText(stat.name) || `Kaggle team ${stat.teamId}`;
const points = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 2 });
const movement = (stat: NewsStat) => stat.rankChange == null ? '' : stat.rankChange === 0 ? 'unchanged' : `${stat.rankChange > 0 ? 'up' : 'down'} ${Math.abs(stat.rankChange)}`;
/** Long headlines step down in size so three lines always fit above the box score. */
const headlineSize = (text: string) => text.length <= 42 ? 72 : text.length <= 64 ? 62 : text.length <= 90 ? 52 : 44;

const kicker = (text: string, style: Style = {}) => box({ fontFamily: SANS, fontWeight: 700, fontSize: 22, letterSpacing: 2.5, textTransform: 'uppercase', color: RED, ...style }, text);
const footer = (right: string) => box({ justifyContent: 'space-between', fontFamily: SANS, fontWeight: 500, fontSize: 20, color: MUTED, letterSpacing: 1 },
  box({}, 'arc.markbarney.net/news'), box({}, right));
const dek = (text: string, size: number, lines: number, style: Style = {}) =>
  box({ fontFamily: SERIF, fontWeight: 400, fontSize: size, lineHeight: 1.35, color: MUTED, ...clamp(lines), ...style }, cardText(text));
function masthead(size: number, centred = false): Node {
  return box({ flexDirection: 'column' },
    box({ height: 6, background: INK }),
    box({ justifyContent: centred ? 'center' : 'space-between', alignItems: 'flex-end', padding: '14px 0 10px' },
      box({ fontFamily: SERIF, fontWeight: 700, fontSize: size, color: INK, lineHeight: 1 }, NEWS_NAME),
      centred ? null : box({ fontFamily: SANS, fontWeight: 500, fontSize: 20, color: MUTED, letterSpacing: 2, textTransform: 'uppercase', paddingBottom: 6 }, 'ARC Prize 2026 · Kaggle')),
    box({ height: 3, background: INK }), box({ height: 3 }), box({ height: 1, background: INK }));
}
/**
 * A headline set word by word. satori breaks lines after hyphens ("ARC-" / "AGI-3"), and the
 * fonts have no non-breaking hyphen, so each word is its own box and lines only break at
 * spaces. Lines past `lines` are clipped by the fixed height.
 */
function headlineBlock(text: string, size: number, lines: number, style: Style = {}): Node {
  const lineHeight = Math.round(size * 1.12);
  return box({ flexWrap: 'wrap', maxHeight: lineHeight * lines, overflow: 'hidden', fontFamily: SERIF, fontWeight: 700, fontSize: size, color: INK, ...style },
    ...text.split(' ').map(word => box({ height: lineHeight, lineHeight: `${lineHeight}px`, marginRight: Math.round(size * 0.26) }, word)));
}
const clamp = (lines: number): Style => ({ display: 'block', lineClamp: lines, overflow: 'hidden' } as Style);

function articleCard(article: NewsArticle): Node {
  const headline = cardText(article.headline);
  const standings = cardStandings(article);
  return box({ width: NEWS_CARD_WIDTH, height: NEWS_CARD_HEIGHT, flexDirection: 'column', background: PAPER, padding: '34px 60px 30px' },
    masthead(50),
    kicker(`${competitionName(article.competition)}  ·  ${editionLabel(article)}  ·  ${newsDate(article.date)}`, { marginTop: 24 }),
    headlineBlock(headline, headlineSize(headline), 3, { marginTop: 14 }),
    dek(article.dek, 26, headline.length <= 64 ? 2 : 1, { marginTop: 16 }),
    box({ flexGrow: 1 }),
    standings.length ? box({ flexDirection: 'column', borderTop: `3px solid ${INK}`, paddingTop: 10, marginBottom: 16 },
      box({ fontFamily: SANS, fontWeight: 700, fontSize: 17, letterSpacing: 2, color: MUTED, textTransform: 'uppercase', marginBottom: 8 }, 'The box score'),
      box({}, ...standings.map((stat, index) => box({ flex: 1, alignItems: 'baseline', paddingLeft: index ? 22 : 0, marginLeft: index ? 22 : 0, borderLeft: index ? `1px solid ${RULE}` : 'none', overflow: 'hidden' },
        box({ fontFamily: SERIF, fontWeight: 700, fontSize: 38, color: RED, marginRight: 12 }, String(stat.rank)),
        box({ flexDirection: 'column', overflow: 'hidden' },
          box({ fontFamily: SERIF, fontWeight: 700, fontSize: 26, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 270 }, teamName(stat)),
          box({ fontFamily: SANS, fontWeight: 500, fontSize: 20, color: MUTED }, `${points(stat.score)} ${stat.score === 1 ? 'point' : 'points'}${movement(stat) ? ` · ${movement(stat)}` : ''}`)))))) : null,
    footer('Early and late editions'));
}

function sectionCard(articles: NewsArticle[]): Node {
  const latest = (['arc-3', 'arc-2'] as const).map(key => articles.find(article => article.competition === key)).filter((article): article is NewsArticle => !!article);
  return box({ width: NEWS_CARD_WIDTH, height: NEWS_CARD_HEIGHT, flexDirection: 'column', background: PAPER, padding: '34px 60px 30px' },
    masthead(96, true),
    box({ justifyContent: 'center', marginTop: 14 }, kicker('ARC Prize 2026  ·  ARC-AGI-3 and ARC-AGI-2  ·  Early and late editions, 6 am and 6 pm ET', { fontSize: 20 })),
    box({ marginTop: 34, flexGrow: 1 }, ...(latest.length ? latest.map((article, index) => box({ flex: 1, flexDirection: 'column', paddingLeft: index ? 30 : 0, marginLeft: index ? 30 : 0, borderLeft: index ? `1px solid ${RULE}` : 'none' },
      kicker(`${competitionName(article.competition)}  ·  ${newsDate(article.date)}`, { fontSize: 19 }),
      headlineBlock(cardText(article.headline), 38, 3, { marginTop: 10 }),
      dek(article.dek, 22, 3, { marginTop: 12 }))) :
      [box({ fontFamily: SERIF, fontSize: 38, color: INK }, 'The first edition is on its way.')])),
    box({ borderTop: `1px solid ${RULE}`, paddingTop: 12, flexDirection: 'column' }, footer('Box scores, contenders and sourced competitor notes')));
}

const renderSvg = (node: Node) => satori(node as Parameters<typeof satori>[0], { width: NEWS_CARD_WIDTH, height: NEWS_CARD_HEIGHT, fonts: loadFonts() });
async function render(node: Node): Promise<Buffer> {
  return sharp(Buffer.from(await renderSvg(node))).flatten({ background: PAPER }).png({ compressionLevel: 9 }).toBuffer();
}

/** Uncached render of one article's card; also used by tests with synthetic articles. */
export const renderArticleCard = (article: NewsArticle) => render(articleCard(article));
/** The intermediate SVG, for the test that proves it needs no system fonts (no <text>). */
export const articleCardSvg = (article: NewsArticle) => renderSvg(articleCard(article));

const cache = new Map<string, Buffer>();
async function cached(key: string, node: () => Node, label: string): Promise<Buffer | null> {
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const card = await render(node());
    cache.set(key, card);
    return card;
  } catch (error) {
    logger.error(`news og-image: failed to render ${label} - ${error instanceof Error ? error.message : String(error)}`, 'news');
    return null;
  }
}

/** The card for one published article, or null when the article does not exist. */
export async function buildArticleCard(id: string): Promise<Buffer | null> {
  const article = getNewsIndex().articles.find(item => item.id === id);
  if (!article) return null;
  return cached(`article:${article.id}:${articleCardVersion(article)}`, () => articleCard(article), article.id);
}

/** The front-page card; keyed by the editions it shows, so a new edition re-renders it. */
export async function buildSectionCard(): Promise<Buffer | null> {
  const { articles } = getNewsIndex();
  return cached(`section:${articles.slice(0, 6).map(article => `${article.id}:${articleCardVersion(article)}`).join(',')}`, () => sectionCard(articles), 'section card');
}
