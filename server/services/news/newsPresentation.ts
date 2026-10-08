/**
 * Author: GPT-6.1 Sol / Codex; Claude Opus 5.5 (Bubba)
 * Date: 2026-10-08
 * PURPOSE: Server-readable newspaper, article and notebook HTML plus genuine NewsArticle
 *          metadata, archive sitemap URLs and RSS, all from the committed newsroom store.
 *          08-Oct-2026: per-article share cards and Open Graph article fields; the front
 *          page and notebook are CollectionPages listing their entries; readable Eastern
 *          dates and competition names in the crawler body; sitemap lastmod from real
 *          publication/check times; RSS self link, build date, categories and card images.
 *          Front-page crawler text follows the ARC-AGI-3-first landing page and its resources.
 * SRP/DRY check: Pass — plain rendering only; content and validation remain in newsStore,
 *          wording and card URLs in shared/news.ts, card pixels in newsCardImage.ts.
 */
import { type RouteMetaTags, ROUTE_META_TAGS } from '../../../shared/routes';
import {
  type NewsArticle, type CompetitorRecord, type NewsStat, newsArticlePath, competitorPath, NEWS_NAME, articleStructuredData,
  articleTitle, articleDescription, articleCardPath, articleCardAlt, competitionName, editionLabel, newsDate,
  competitorTitle, competitorDescription, NEWS_CARD_WIDTH, NEWS_CARD_HEIGHT,
} from '../../../shared/news';
import { escapeHtml as esc, SITE_ORIGIN, completeMeta } from '../../../shared/seo';
import { getNewsIndex } from './newsStore';
export const boardPath = (competition: string) => competition === 'arc-2' ? '/kaggle-leaderboard/arc-2' : '/kaggle-leaderboard';
const articleLink = (article: NewsArticle) => `<a href="${newsArticlePath(article.id)}">${esc(article.headline)}</a>`;
const sourceList = (article: NewsArticle) => `<ol>${article.sources.map(source => `<li id="source-${esc(source.id)}"><a href="${esc(source.url)}">${esc(source.title)}</a></li>`).join('')}</ol>`;
const newlineText = (text: string) => text.split(/\n\n+/).map(paragraph => `<p>${esc(paragraph)}</p>`).join('');
const timeTag = (value: string, withTime = true) => `<time datetime="${esc(value)}">${esc(newsDate(value, withTime))}</time>`;
const kicker = (article: NewsArticle) => `${esc(competitionName(article.competition))} · ${esc(editionLabel(article))} · ${timeTag(article.date, false)}`;
const rankChange = (stat: NewsStat) => stat.rankChange == null ? 'Not available' : stat.rankChange === 0 ? 'Unchanged' : `${stat.rankChange > 0 ? 'Up' : 'Down'} ${Math.abs(stat.rankChange)}`;
const scoreChange = (stat: NewsStat) => stat.scoreChange == null ? 'Not available' : `${stat.scoreChange > 0 ? '+' : ''}${stat.scoreChange}`;
/** A CollectionPage whose ItemList names each linked entry, for the two index pages. */
function collection(tags: RouteMetaTags, items: { name: string; path: string }[]): Record<string, unknown> {
  return { '@context': 'https://schema.org', '@graph': [{
    '@type': 'CollectionPage', '@id': tags.url, url: tags.url, name: tags.title, description: tags.description, inLanguage: 'en',
    isPartOf: { '@id': `${SITE_ORIGIN}/#website` }, ...(tags.image ? { primaryImageOfPage: { '@type': 'ImageObject', url: tags.image, width: NEWS_CARD_WIDTH, height: NEWS_CARD_HEIGHT } } : {}),
    mainEntity: { '@type': 'ItemList', numberOfItems: items.length,
      itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, url: `${SITE_ORIGIN}${item.path}` })) },
  }] };
}
export function newsArticleMeta(article: NewsArticle): RouteMetaTags {
  const url = `${SITE_ORIGIN}${newsArticlePath(article.id)}`;
  const jsonLd = articleStructuredData(article, SITE_ORIGIN);
  const bodyHtml = `<main><article><p>${kicker(article)}</p>
    <h1>${esc(article.headline)}</h1><p>${esc(article.dek)}</p><p>ARC Daily sports desk · Written with GPT-6 SOL</p>
    <p>Published ${timeTag(article.publishedAt)}. Data as of ${timeTag(article.dataAsOf)}.</p>
    ${article.sections.map(section => `${section.heading ? `<h2>${esc(section.heading)}</h2>` : ''}${newlineText(section.text)}<p>${section.sourceIds.map(id => { const source = article.sources.find(source => source.id === id)!; return `<a href="${esc(source.url)}">${esc(source.title)}</a>`; }).join(' · ')}</p>`).join('')}
    <h2>From the box score</h2><table><thead><tr><th>Team</th><th>Rank</th><th>Score</th><th>Rank change</th><th>Score change</th></tr></thead><tbody>${article.stats.map(stat => `<tr><td><a href="${competitorPath(`${article.competition}-${stat.teamId}`)}">${esc(stat.name)}</a></td><td>${stat.rank}</td><td>${stat.score}</td><td>${rankChange(stat)}</td><td>${scoreChange(stat)}</td></tr>`).join('')}</tbody></table>
    <p>${esc(article.coverageNote)}</p><p><a href="${boardPath(article.competition)}">Full live ${esc(competitionName(article.competition))} box score</a> · <a href="/news">The ARC Daily front page</a> · <a href="/news/competitors">Competitor notebook</a> · <a href="/api/news/${esc(article.id)}/evidence">Archived reporting data</a></p>
    <h2>Sources</h2>${sourceList(article)}</article></main>`;
  return completeMeta({ title: articleTitle(article), description: articleDescription(article), url, type: 'article', jsonLd, bodyHtml,
    image: `${SITE_ORIGIN}${articleCardPath(article)}`, imageAlt: articleCardAlt(article), imageWidth: NEWS_CARD_WIDTH, imageHeight: NEWS_CARD_HEIGHT,
    publishedTime: article.publishedAt, section: competitionName(article.competition) });
}
function competitorMeta(record: CompetitorRecord, articles: NewsArticle[]): RouteMetaTags {
  const description = competitorDescription(record);
  const coverage = articles.filter(article => article.competition === record.competition && article.teamIds.includes(record.teamId));
  return completeMeta({ ...ROUTE_META_TAGS['/news/competitors'], title: competitorTitle(record), description,
    url: `${SITE_ORIGIN}${competitorPath(record.id)}`, bodyHtml: `<main><h1>${esc(record.name)}</h1><p>${esc(description)}</p>
    <p>Competition: ${esc(competitionName(record.competition))}. Team ID: ${esc(record.teamId)}.</p>
    <p>First observed by the newspaper: ${timeTag(record.firstObservedAt)}. Last checked: ${timeTag(record.lastObservedAt)}. Observation dates are not competition join dates.</p>
    <h2>Public team roster</h2><ul>${record.members.map(member => `<li><a href="https://www.kaggle.com/${encodeURIComponent(member)}">${esc(member)}</a></li>`).join('')}</ul>
    ${record.aliases.length ? `<h2>Observed names</h2><p>${record.aliases.map(esc).join(', ')}</p>` : ''}
    <h2>What is on the record</h2>${record.facts.length ? record.facts.map(fact => `<p>${esc(fact.text)} <a href="${esc(fact.sourceUrl)}">${esc(fact.sourceTitle)}</a> (checked ${timeTag(fact.checkedAt, false)})</p>`).join('') : '<p>No sourced background notes have been added yet.</p>'}
    <h2>In the paper</h2>${coverage.length ? `<ul>${coverage.map(article => `<li>${articleLink(article)}</li>`).join('')}</ul>` : '<p>Not yet named in an edition.</p>'}
    <p><a href="${boardPath(record.competition)}">Live ${esc(competitionName(record.competition))} box score</a> · <a href="/news/competitors">Competitor notebook</a> · <a href="/news">The ARC Daily front page</a></p></main>` });
}
function frontPageMeta(articles: NewsArticle[]): RouteMetaTags {
  const tags = completeMeta(ROUTE_META_TAGS['/news']);
  return { ...tags, jsonLd: collection(tags, articles.map(article => ({ name: article.headline, path: newsArticlePath(article.id) }))),
    bodyHtml: `<main><h1>${NEWS_NAME}: the ARC-AGI-3 Kaggle contest daily</h1><p>Morning and evening reporting from recorded public leaderboard observations and cited sources. ARC-AGI-2 is covered as a separate competition.</p><p><a href="/kaggle-leaderboard#medal-race">ARC-AGI-3 medal race graphic</a> · <a href="/kaggle-leaderboard#score-history">Score history</a> · <a href="/human-records.html">Human and AI game records</a> · <a href="/arc3/games">Public game guides</a> · <a href="/news/competitors">Competitor notebook</a> · <a href="/news/feed.xml">RSS feed</a> · <a href="/kaggle-leaderboard/arc-2">ARC-AGI-2 standings</a></p>${articles.length ? `<h2>Latest editions</h2>${articles.map(article => `<article><p>${kicker(article)}</p><h3>${articleLink(article)}</h3><p>${esc(article.dek)}</p></article>`).join('')}` : '<p>The first edition is being prepared.</p>'}</main>` };
}
function notebookMeta(competitors: CompetitorRecord[]): RouteMetaTags {
  const tags = completeMeta(ROUTE_META_TAGS['/news/competitors']);
  return { ...tags, jsonLd: collection(tags, competitors.map(record => ({ name: `${record.name} (${competitionName(record.competition)})`, path: competitorPath(record.id) }))),
    bodyHtml: `<main><h1>Competitor notebook</h1><p>Sourced background and observed public team identities. Teams in different competitions have separate records.</p><ul>${competitors.map(record => `<li><a href="${competitorPath(record.id)}">${esc(record.name)}</a> — ${esc(competitionName(record.competition))}</li>`).join('')}</ul><p><a href="/news">Back to the sports page</a></p></main>` };
}
export function resolveNewsMeta(route: string): { tags: RouteMetaTags; status: number } | null {
  if (route !== '/news' && !route.startsWith('/news/')) return null;
  const { articles, competitors } = getNewsIndex();
  if (route === '/news') return { status: 200, tags: frontPageMeta(articles) };
  if (route === '/news/competitors') return { status: 200, tags: notebookMeta(competitors) };
  const profile = route.match(/^\/news\/competitors\/([a-z0-9-]+)$/);
  if (profile) { const record = competitors.find(record => record.id === profile[1]); if (record) return { status: 200, tags: competitorMeta(record, articles) }; }
  const article = articles.find(article => newsArticlePath(article.id) === route);
  if (article) return { status: 200, tags: newsArticleMeta(article) };
  return { status: 404, tags: completeMeta({ title: `Page not found | ${NEWS_NAME}`, description: 'This newspaper page could not be found. Visit The ARC Daily for current coverage.', url: `${SITE_ORIGIN}${route}`, noindex: true }) };
}
const latest = (values: string[]) => values.reduce<string | undefined>((max, value) => !max || value > max ? value : max, undefined);
/** News URLs with a real last-change time: publication for editions, last check for notebooks. */
export function newsSitemapEntries(): { url: string; lastmod?: string }[] {
  const { articles, competitors } = getNewsIndex();
  return [
    { url: `${SITE_ORIGIN}/news`, lastmod: latest(articles.map(article => article.publishedAt)) },
    { url: `${SITE_ORIGIN}/news/competitors`, lastmod: latest(competitors.map(record => record.lastObservedAt)) },
    ...articles.map(article => ({ url: `${SITE_ORIGIN}${newsArticlePath(article.id)}`, lastmod: article.publishedAt })),
    ...competitors.map(record => ({ url: `${SITE_ORIGIN}${competitorPath(record.id)}`, lastmod: record.lastObservedAt })),
  ];
}
export const newsSitemapUrls = (): string[] => newsSitemapEntries().map(entry => entry.url);
export function newsRss(): string {
  const { articles } = getNewsIndex();
  const feed = `${SITE_ORIGIN}/news/feed.xml`;
  const built = latest(articles.map(article => article.publishedAt));
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>${NEWS_NAME}</title><link>${SITE_ORIGIN}/news</link><atom:link href="${feed}" rel="self" type="application/rss+xml"/><description>Morning and evening reporting on the ARC Prize 2026 ARC-AGI-3 and ARC-AGI-2 Kaggle competitions.</description><language>en</language>${built ? `<lastBuildDate>${new Date(built).toUTCString()}</lastBuildDate>` : ''}<ttl>60</ttl>${articles.slice(0, 40).map(article => {
    const link = `${SITE_ORIGIN}${newsArticlePath(article.id)}`;
    return `<item><title>${esc(article.headline)}</title><link>${link}</link><guid isPermaLink="true">${link}</guid><pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate><category>${esc(competitionName(article.competition))}</category><description>${esc(article.dek)}</description><media:content url="${esc(`${SITE_ORIGIN}${articleCardPath(article)}`)}" medium="image" type="image/png" width="${NEWS_CARD_WIDTH}" height="${NEWS_CARD_HEIGHT}"><media:description>${esc(articleCardAlt(article))}</media:description></media:content></item>`;
  }).join('')}</channel></rss>`;
}
