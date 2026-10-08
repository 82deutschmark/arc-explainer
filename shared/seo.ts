/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-07
 * PURPOSE: Shared URL, indexing, safe HTML and structured-data policy for server responses
 *          and SPA navigation. Content remains in the existing route and game registries.
 * SRP/DRY check: Pass — one canonical origin and metadata serialization contract.
 */
import { ROUTE_META_TAGS, type RouteMetaTags } from './routes';
export const SITE_ORIGIN = 'https://arc.markbarney.net';
export const DEFAULT_IMAGE = `${SITE_ORIGIN}/og-preview.png`;
export const INDEX_ROBOTS = 'index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1';
export const REDIRECTS: Record<string, string> = {
  '/synthetic': '/', '/human-cards': '/hall-of-fame', '/compare': '/elo',
  '/arc3/review': '/play', '/arc3/archive': '/arc3', '/arc3/archive/games': '/arc3/games',
  '/snake-arena': '/worm-arena', '/re-arc/leaderboard': '/re-arc', '/index.html': '/',
};
export function normalizePath(value: string): string {
  return value.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
}
export function redirectPath(value: string): string | undefined {
  const route = normalizePath(value);
  if (REDIRECTS[route]) return REDIRECTS[route];
  const legacyGame = route.match(/^\/arc3\/archive\/games\/([A-Za-z0-9_-]+)$/);
  if (legacyGame) return `/arc3/games/${legacyGame[1].toLowerCase()}`;
  const puzzle = route.match(/^\/examine\/([a-f0-9]{8})$/i);
  if (puzzle) return `/puzzle/${puzzle[1].toLowerCase()}`;
  const compare = route.match(/^\/compare\/([a-f0-9]{8})$/i);
  if (compare) return `/elo/${compare[1].toLowerCase()}`;
  const game = route.match(/^\/arc3\/games\/([A-Za-z0-9_-]+)$/);
  if (game && game[1] !== game[1].toLowerCase()) return `/arc3/games/${game[1].toLowerCase()}`;
  return undefined;
}
export function escapeHtml(value: string): string {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
export function pageBreadcrumbs(tags: RouteMetaTags): { name: string; url: string }[] {
  const route = new URL(tags.url).pathname;
  if (route === '/') return [];
  const items = [{ name: 'Home', url: `${SITE_ORIGIN}/` }];
  const game = route.match(/^\/arc3\/games\/([a-z0-9_-]+)$/);
  if (game) items.push({ name: 'Game guides', url: `${SITE_ORIGIN}/arc3/games` });
  items.push({ name: game ? game[1] : tags.title.replace(/ \| ARC Explainer$/, ''), url: tags.url });
  return items;
}
export function structuredData(tags: RouteMetaTags): Record<string, unknown> {
  const customGraph = tags.jsonLd?.['@graph'];
  const graph: Record<string, unknown>[] = Array.isArray(customGraph)
    ? customGraph.filter(node => node['@type'] !== 'BreadcrumbList')
    : [{ '@type': 'WebPage', '@id': tags.url, url: tags.url, name: tags.title, description: tags.description,
        isPartOf: { '@id': `${SITE_ORIGIN}/#website` }, inLanguage: 'en' }];
  graph.push({ '@type': 'WebSite', '@id': `${SITE_ORIGIN}/#website`, name: 'ARC Explainer', url: `${SITE_ORIGIN}/`, inLanguage: 'en' });
  const crumbs = pageBreadcrumbs(tags);
  if (crumbs.length && !tags.noindex) graph.push({ '@type': 'BreadcrumbList', itemListElement: crumbs.map((crumb, index) => ({ '@type': 'ListItem', position: index + 1, name: crumb.name, item: crumb.url })) });
  return { '@context': 'https://schema.org', '@graph': graph };
}
export function breadcrumbsHtml(tags: RouteMetaTags): string {
  if (tags.noindex) return '';
  const crumbs = pageBreadcrumbs(tags);
  return crumbs.length ? `<nav aria-label="Breadcrumb">${crumbs.map((crumb, index) => index === crumbs.length - 1 ? `<span aria-current="page">${escapeHtml(crumb.name)}</span>` : `<a href="${escapeHtml(new URL(crumb.url).pathname)}">${escapeHtml(crumb.name)}</a>`).join(' / ')}</nav>` : '';
}
export const DISCOVERY_LINKS = [
  ['/', 'Home'], ['/home', 'Resource hub'], ['/kaggle-leaderboard', 'ARC-AGI-3 leaderboard'],
  ['/kaggle-leaderboard/arc-2', 'ARC-AGI-2 leaderboard'], ['/arc3/games', 'Game guides'],
  ['/arc3/slippery-seven', 'Slippery Seven'], ['/arc3/gallery', 'Community tasks'],
  ['/arc3/hypotheses', 'Research'], ['/browser', 'ARC puzzles'], ['/analytics', 'Model results archive'],
  ['/about', 'About'],
] as const;
export function discoveryHtml(): string {
  return `<nav aria-label="Explore ARC Explainer"><ul>${DISCOVERY_LINKS.map(([url, name]) => `<li><a href="${url}">${name}</a></li>`).join('')}</ul></nav>`;
}
export function completeMeta(tags: RouteMetaTags): RouteMetaTags {
  return { ...tags, image: tags.image || DEFAULT_IMAGE, imageAlt: tags.imageAlt || (tags.image ? tags.title : 'ARC Explainer — puzzles, games and results') };
}
/** Dynamic tool routes are valid app screens, not independent search landing pages. */
export function clientRouteMeta(value: string): RouteMetaTags {
  const route = redirectPath(value) || normalizePath(value);
  if (Object.hasOwn(ROUTE_META_TAGS, route)) return completeMeta(ROUTE_META_TAGS[route]);
  const game = route.match(/^\/arc3\/games\/([a-z0-9_-]+)$/);
  const puzzle = route.match(/^\/puzzle\/([A-Za-z0-9_-]{1,128})$/);
  const play = route.match(/^\/arc3\/play\/([A-Za-z0-9_.-]{1,64})$/);
  const tool = /^\/(?:discussion|elo|test-solution|debate|council)\/[^/]+$/.test(route)
    || /^\/puzzle\/(?:saturn|grover|beetree|poetiq)\/[^/]+$/.test(route)
    || /^\/task\/[^/]+(?:\/efficiency)?$/.test(route)
    || /^\/worm-arena\/live\/[^/]+$/.test(route);
  const title = game ? `${game[1]} — ARC-AGI-3 game guide` : puzzle ? `ARC puzzle ${puzzle[1]}` : play ? `${play[1]} — ARC-AGI-3 task` : tool ? 'ARC Explainer interactive workspace' : 'Page not found | ARC Explainer';
  return completeMeta({ title, description: game ? 'Game mechanics, level screenshots and notes from play.' : puzzle ? 'Explore this ARC puzzle and its model answers.' : play ? 'Explore an interactive reasoning task without instructions.' : tool ? 'Use ARC Explainer’s interactive analysis tools.' : 'This address does not match an ARC Explainer page. Explore the resource hub or game guides.',
    url: `${SITE_ORIGIN}${route}`, noindex: !game && !puzzle,
    image: game ? `${SITE_ORIGIN}/api/arc3/og-image/${game[1]}` : puzzle ? `${SITE_ORIGIN}/api/og-image/${puzzle[1]}` : undefined });
}
export function isDynamicAppRoute(route: string): boolean {
  return /^\/(?:discussion|elo|test-solution|debate|council)\/[^/]+$/.test(route)
    || /^\/puzzle\/(?:saturn|grover|beetree|poetiq)\/[^/]+$/.test(route)
    || /^\/task\/[^/]+(?:\/efficiency)?$/.test(route)
    || /^\/worm-arena\/live\/[^/]+$/.test(route)
    || /^\/arc3\/play\/[A-Za-z0-9_.-]{1,64}$/.test(route);
}
