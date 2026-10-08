/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-07
 * PURPOSE: Server-readable newspaper, article and notebook HTML plus genuine NewsArticle
 *          metadata, archive sitemap URLs and RSS, all from the committed newsroom store.
 * SRP/DRY check: Pass — plain rendering only; content and validation remain in newsStore.
 */
import { type RouteMetaTags } from '../../../shared/routes';
import { type NewsArticle, type CompetitorRecord, newsArticlePath, competitorPath, NEWS_NAME, articleStructuredData } from '../../../shared/news';
import { escapeHtml as esc, SITE_ORIGIN, DEFAULT_IMAGE, completeMeta } from '../../../shared/seo';
import { getNewsIndex } from './newsStore';
export const boardPath = (competition: string) => competition === 'arc-2' ? '/kaggle-leaderboard/arc-2' : '/kaggle-leaderboard';
const competitionName = (key: string) => key === 'arc-2' ? 'ARC-AGI-2' : 'ARC-AGI-3';
const articleLink = (article: NewsArticle) => `<a href="${newsArticlePath(article.id)}">${esc(article.headline)}</a>`;
const sourceList = (article: NewsArticle) => `<ol>${article.sources.map(source => `<li id="source-${esc(source.id)}"><a href="${esc(source.url)}">${esc(source.title)}</a></li>`).join('')}</ol>`;
const newlineText = (text: string) => text.split(/\n\n+/).map(paragraph => `<p>${esc(paragraph)}</p>`).join('');
export function newsArticleMeta(article: NewsArticle): RouteMetaTags {
  const url = `${SITE_ORIGIN}${newsArticlePath(article.id)}`;
  const jsonLd = articleStructuredData(article, SITE_ORIGIN, DEFAULT_IMAGE);
  const bodyHtml = `<main><article><p>${esc(competitionName(article.competition))} · ${article.edition === 'morning' ? 'Morning' : 'Evening'} edition · ${esc(article.date)}</p>
    <h1>${esc(article.headline)}</h1><p>${esc(article.dek)}</p><p>ARC Daily sports desk · Written with GPT-6 SOL</p>
    <p>Published <time datetime="${esc(article.publishedAt)}">${esc(article.publishedAt)}</time>. Data as of ${esc(article.dataAsOf)}.</p>
    ${article.sections.map(section => `${section.heading ? `<h2>${esc(section.heading)}</h2>` : ''}${newlineText(section.text)}<p>${section.sourceIds.map(id => { const source = article.sources.find(source => source.id === id)!; return `<a href="${esc(source.url)}">${esc(source.title)}</a>`; }).join(' · ')}</p>`).join('')}
    <h2>From the box score</h2><table><thead><tr><th>Team</th><th>Rank</th><th>Score</th><th>Rank change</th><th>Score change</th></tr></thead><tbody>${article.stats.map(stat => `<tr><td><a href="${competitorPath(`${article.competition}-${stat.teamId}`)}">${esc(stat.name)}</a></td><td>${stat.rank}</td><td>${stat.score}</td><td>${stat.rankChange ?? 'Unavailable'}</td><td>${stat.scoreChange ?? 'Unavailable'}</td></tr>`).join('')}</tbody></table>
    <p>${esc(article.coverageNote)}</p><p><a href="${boardPath(article.competition)}">Full live box score</a> · <a href="/news">The ARC Daily archive</a> · <a href="/api/news/${esc(article.id)}/evidence">Archived reporting data</a></p>
    <h2>Sources</h2>${sourceList(article)}</article></main>`;
  return completeMeta({ title: `${article.headline} | ${NEWS_NAME}`, description: article.dek, url, type: 'article', jsonLd, bodyHtml });
}
function competitorMeta(record: CompetitorRecord, articles: NewsArticle[]): RouteMetaTags {
  const description = `The ${competitionName(record.competition)} competitor notebook for ${record.name}: sourced background, observed team names and ARC Daily coverage.`;
  return completeMeta({ title: `${record.name} — ${competitionName(record.competition)} competitor | ${NEWS_NAME}`, description,
    url: `${SITE_ORIGIN}${competitorPath(record.id)}`, bodyHtml: `<main><h1>${esc(record.name)}</h1><p>${esc(description)}</p>
    <p>Competition: ${esc(competitionName(record.competition))}. Team ID: ${esc(record.teamId)}.</p>
    <p>First observed by the newspaper: ${esc(record.firstObservedAt)}. Last checked: ${esc(record.lastObservedAt)}. Observation dates are not competition join dates.</p>
    <h2>Public team roster</h2><ul>${record.members.map(member => `<li><a href="https://www.kaggle.com/${encodeURIComponent(member)}">${esc(member)}</a></li>`).join('')}</ul>
    ${record.aliases.length ? `<h2>Observed names</h2><p>${record.aliases.map(esc).join(', ')}</p>` : ''}
    <h2>What is on the record</h2>${record.facts.length ? record.facts.map(fact => `<p>${esc(fact.text)} <a href="${esc(fact.sourceUrl)}">${esc(fact.sourceTitle)}</a> (checked ${esc(fact.checkedAt)})</p>`).join('') : '<p>No sourced background notes have been added yet.</p>'}
    <h2>In the paper</h2><ul>${articles.filter(article => article.competition === record.competition && article.teamIds.includes(record.teamId)).map(article => `<li>${articleLink(article)}</li>`).join('')}</ul>
    <p><a href="${boardPath(record.competition)}">Live box score</a> · <a href="/news/competitors">Competitor notebook</a></p></main>` });
}
export function resolveNewsMeta(route: string): { tags: RouteMetaTags; status: number } | null {
  if (route !== '/news' && !route.startsWith('/news/')) return null;
  const { articles, competitors } = getNewsIndex();
  if (route === '/news') return { status: 200, tags: completeMeta({ title: `${NEWS_NAME} — ARC-AGI competition news`, description: 'Morning and evening sports-page coverage of the ARC-AGI-2 and ARC-AGI-3 Kaggle races: the moves, the contenders and the stories behind the box scores.', url: `${SITE_ORIGIN}/news`, bodyHtml: `<main><h1>${NEWS_NAME}</h1><p>The ARC competition sports page. Morning and evening editions, written with GPT-6 SOL from recorded public leaderboard data and cited sources.</p><p><a href="/news/competitors">Competitor notebook</a> · <a href="/news/feed.xml">RSS feed</a> · <a href="/kaggle-leaderboard">ARC-AGI-3 box scores</a> · <a href="/kaggle-leaderboard/arc-2">ARC-AGI-2 box scores</a></p>${articles.length ? articles.map(article => `<article><p>${esc(article.date)} · ${esc(article.competition)} · ${article.edition}</p><h2>${articleLink(article)}</h2><p>${esc(article.dek)}</p></article>`).join('') : '<p>The first edition is being prepared.</p>'}</main>` }) };
  if (route === '/news/competitors') return { status: 200, tags: completeMeta({ title: `Competitor notebook | ${NEWS_NAME}`, description: 'The ARC Daily’s growing, sourced notebook of ARC-AGI competitors, their public team identities and competition coverage.', url: `${SITE_ORIGIN}${route}`, bodyHtml: `<main><h1>Competitor notebook</h1><p>Sourced background and observed public team identities. Teams in different competitions have separate records.</p><ul>${competitors.map(record => `<li><a href="${competitorPath(record.id)}">${esc(record.name)}</a> — ${esc(competitionName(record.competition))}</li>`).join('')}</ul><p><a href="/news">Back to the sports page</a></p></main>` }) };
  const profile = route.match(/^\/news\/competitors\/([a-z0-9-]+)$/);
  if (profile) { const record = competitors.find(record => record.id === profile[1]); if (record) return { status: 200, tags: competitorMeta(record, articles) }; }
  const article = articles.find(article => newsArticlePath(article.id) === route);
  if (article) return { status: 200, tags: newsArticleMeta(article) };
  return { status: 404, tags: completeMeta({ title: `Page not found | ${NEWS_NAME}`, description: 'This newspaper page could not be found. Visit The ARC Daily for current coverage.', url: `${SITE_ORIGIN}${route}`, noindex: true }) };
}
export function newsSitemapUrls(): string[] {
  const { articles, competitors } = getNewsIndex();
  return [...articles.map(article => `${SITE_ORIGIN}${newsArticlePath(article.id)}`), ...competitors.map(record => `${SITE_ORIGIN}${competitorPath(record.id)}`)];
}
export function newsRss(): string {
  const { articles } = getNewsIndex();
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${NEWS_NAME}</title><link>${SITE_ORIGIN}/news</link><description>Morning and evening ARC-AGI competition reporting.</description><language>en</language>${articles.slice(0, 40).map(article => `<item><title>${esc(article.headline)}</title><link>${SITE_ORIGIN}${newsArticlePath(article.id)}</link><guid isPermaLink="true">${SITE_ORIGIN}${newsArticlePath(article.id)}</guid><pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate><description>${esc(article.dek)}</description></item>`).join('')}</channel></rss>`;
}
