/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-07
 * PURPOSE: Build crawler-readable public page summaries and official game guides from
 *          the existing route, puzzle and game registries without a second content store.
 * SRP/DRY check: Pass — gameLevels owns level grouping; no authored rules are changed.
 */
import { ROUTE_META_TAGS, type RouteMetaTags } from '../../../shared/routes';
import { SITE_ORIGIN, clientRouteMeta, completeMeta, escapeHtml as esc, isDynamicAppRoute } from '../../../shared/seo';
import { getAllGames, type Arc3GameMetadata } from '../../../shared/arc3Games';
import { buildGameLevels } from '../../../shared/arc3Games/gameLevels';
import { getArcBaseline } from '../../../shared/arc3Games/humanDifficulty';
import { puzzleLoader } from '../puzzleLoader';

const paragraphs = (text?: string) => text ? `<p>${esc(text).replace(/\n\n/g, '</p><p>')}</p>` : '';
const gameLink = (id: string) => `<a href="/arc3/games/${esc(id)}">${esc(id)}</a>`;
export function publicPageLinks(): string {
  return `<ul>${Object.entries(ROUTE_META_TAGS).filter(([, meta]) => !meta.noindex).map(([url, meta]) => `<li><a href="${esc(url)}">${esc(meta.title)}</a></li>`).join('')}<li><a href="/human-arc/">Human ARC</a></li><li><a href="/human-records.html">Human and AI game comparison</a></li></ul>`;
}
function gameBody(game: Arc3GameMetadata): string {
  const levels = buildGameLevels(game, [], getArcBaseline(game.gameId));
  return `<main>
    <h1>${esc(game.gameId)} — ARC-AGI-3 game guide</h1>
    ${game.gameId === 'as66' ? '<p>This withdrawn preview game is retained as a historical guide; it is not in the current public demo set.</p>' : ''}
    <p>Full spoilers for this public game. Play first if you want to discover its rules yourself.</p>
    ${paragraphs(game.description)}${paragraphs(game.simpleExplanation)}
    <h2>Controls</h2><ul>${game.actionMappings.map(action => `<li><strong>${esc(action.action)}</strong>: ${esc(action.description)}${action.notes ? ` — ${esc(action.notes)}` : ''}</li>`).join('')}</ul>
    <h2>Level by level</h2>${levels.levels.map(level => `<section><h3>Level ${level.level}</h3>${level.images.map(shot => `<figure><img src="${esc(shot.imageUrl)}" alt="${esc(`${game.gameId}, level ${level.level}${shot.caption ? `: ${shot.caption}` : ''}`)}" loading="lazy" style="max-width:100%;height:auto"/>${shot.caption ? `<figcaption>${esc(shot.caption)}</figcaption>` : ''}</figure>`).join('')}
    <ul>${level.newRules.map(rule => `<li>${esc(rule.text)}</li>`).join('')}</ul>
    ${level.observations.map(note => paragraphs(`${note.player}, ${note.date}: ${note.saw} ${note.did || ''} ${note.happened}`)).join('')}</section>`).join('')}
    ${game.mechanicsExplanation ? `<h2>Mechanics</h2>${paragraphs(game.mechanicsExplanation)}` : ''}
    ${game.notes ? `<h2>Notes and caveats</h2>${paragraphs(game.notes)}` : ''}
    <p><a href="/arc3/games">All official game guides</a> · <a href="/arc3/slippery-seven">The Slippery Seven</a> · <a href="/human-records.html">Human and AI results</a></p></main>`;
}
export function resolvePageMeta(route: string): { tags: RouteMetaTags; status: number } {
  if (Object.hasOwn(ROUTE_META_TAGS, route)) {
    const tags = { ...ROUTE_META_TAGS[route] };
    if (route === '/arc3/games') {
      tags.bodyHtml = `<main><h1>ARC-AGI-3 Game Mechanics</h1><p>Guides to the 25 public demonstration games, plus separately labeled preview history. These are spoilers; the private competition games have different mechanics.</p><p><a href="/arc3/slippery-seven">The Slippery Seven</a> · <a href="/human-records.html">Human and AI results</a> · <a href="/arc3/games.md">Markdown reference</a></p><ul>${getAllGames().map((game: Arc3GameMetadata) => `<li>${gameLink(game.gameId)}${game.gameId === 'as66' ? ' (withdrawn preview)' : ''} — ${esc(game.simpleExplanation)}</li>`).join('')}</ul></main>`;
    }
    if (route === '/home') tags.bodyHtml = `${tags.bodyHtml}<section><h2>Explore all public sections</h2>${publicPageLinks()}</section>`;
    if (route === '/browser') tags.bodyHtml = `<main><h1>ARC puzzle browser</h1>${paragraphs(tags.description)}<ul>${puzzleLoader.getPuzzleList().map(p => `<li><a href="/puzzle/${encodeURIComponent(p.id)}">${esc(p.id)}</a> — ${esc(p.source)}</li>`).join('')}</ul></main>`;
    return { tags: completeMeta(tags), status: 200 };
  }
  const gameMatch = route.match(/^\/arc3\/games\/([a-z0-9_-]+)$/);
  if (gameMatch) {
    const game: Arc3GameMetadata | undefined = getAllGames().find(game => game.gameId === gameMatch[1]);
    if (game) {
      return { status: 200, tags: completeMeta({
        title: `${game.gameId} — ARC-AGI-3 game mechanics | ARC Explainer`, description: game.simpleExplanation || game.description,
        url: `${SITE_ORIGIN}${route}`, image: `${SITE_ORIGIN}/api/arc3/og-image/${game.gameId}`,
        imageAlt: `${game.gameId} opening game frame`, type: 'article', bodyHtml: gameBody(game),
      }) };
    }
  }
  const puzzleMatch = route.match(/^\/puzzle\/([A-Za-z0-9_-]{1,128})$/);
  if (puzzleMatch) {
    const id = puzzleMatch[1];
    const metadata = puzzleLoader.getPuzzleMetadata(id);
    if (metadata) {
      const tags = completeMeta({ title: `ARC puzzle ${id} — examples and analysis | ARC Explainer`,
        description: `Explore ${metadata.source} puzzle ${id}, its training examples, ${metadata.testCaseCount} test case(s), and recorded model answers.`,
        url: `${SITE_ORIGIN}${route}`, image: `${SITE_ORIGIN}/api/og-image/${encodeURIComponent(id)}`, type: 'article' });
      tags.bodyHtml = `<main><h1>ARC puzzle ${esc(id)}</h1>${paragraphs(tags.description)}<p>Study the input and output grids to infer the transformation. The interactive view lets you inspect model explanations and compare answers.</p><p><a href="/browser">Browse all ARC puzzles</a> · <a href="/analytics">Model results archive</a></p></main>`;
      return { tags, status: 200 };
    }
  }
  if (isDynamicAppRoute(route)) return { tags: clientRouteMeta(route), status: 200 };
  return { status: 404, tags: completeMeta({ title: 'Page not found | ARC Explainer', description: 'This address does not match an ARC Explainer page. Explore the resource hub or game guides.', url: `${SITE_ORIGIN}${route}`, noindex: true }) };
}
export function sitemapUrls(): string[] {
  return [...new Set([
    ...Object.entries(ROUTE_META_TAGS).filter(([, tags]) => !tags.noindex).map(([, tags]) => tags.url),
    `${SITE_ORIGIN}/human-arc/`, `${SITE_ORIGIN}/human-records.html`,
    ...getAllGames().map(game => `${SITE_ORIGIN}/arc3/games/${game.gameId}`),
    ...puzzleLoader.getAvailablePuzzleIds().filter(id => /^[A-Za-z0-9_-]{1,128}$/.test(id)).map(id => `${SITE_ORIGIN}/puzzle/${id}`),
  ])];
}
export function generateSitemap(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls().map(url => `  <url><loc>${esc(url)}</loc></url>`).join('\n')}\n</urlset>\n`;
}
