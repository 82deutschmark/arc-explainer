/**
 * Author: GPT-6 Sol / Codex; Claude Opus 5.5 (Bubba)
 * Date: 2026-10-09; 10-October-2026
 * PURPOSE: Server-readable newspaper, article and notebook HTML plus genuine NewsArticle
 *          metadata, archive sitemap URLs and RSS, all from the committed newsroom store.
 *          08-Oct-2026: per-article share cards and Open Graph article fields; the front
 *          page and notebook are CollectionPages listing their entries; readable Eastern
 *          dates and competition names in the crawler body; sitemap lastmod from real
 *          publication/check times; RSS self link, build date, categories and card images.
 *          Front-page crawler text names both contests, their public resources and the
 *          illustrated Hall of Fame; the article credit uses GPT-6 Sol spelling.
 *          Sourced dispatches, people profiles, public community sources and method copy also render for crawlers.
 *          09-Oct-2026 (Claude Opus 5.5): person pages lead with the person's portrait and honors.
 *          Later the same day: /news/wire renders the wire desk's stories; the front page's
 *          crawler text describes the rebuilt page (What's News, the board, movers, past winners).
 *          10-Oct-2026 (Claude Sonnet 5.5): every page that shares the front-page card advertises
 *          its versioned address (cardFor), so link-preview services refetch it with each new
 *          day and edition; the front page links to the ARC leaderboards hub.
 * SRP/DRY check: Pass — plain rendering only; content and validation remain in newsStore,
 *          wording and card URLs in shared/news.ts, card pixels in newsCardImage.ts.
 */
import { type RouteMetaTags, ROUTE_META_TAGS } from '../../../shared/routes';
import {
  type NewsArticle, type NewsDispatch, type CompetitorRecord, type NewsStat, newsArticlePath, competitorPath, NEWS_NAME, articleStructuredData,
  articleTitle, articleDescription, articleCardPath, articleCardAlt, competitionName, editionLabel, newsDate,
  competitorTitle, competitorDescription, NEWS_CARD_WIDTH, NEWS_CARD_HEIGHT,
  type NewsPerson, type NewsSocialPost, type NewsWireStory, personPath, peopleForTeam, wirePath, sectionCardAlt, sectionCardPath,
} from '../../../shared/news';
import { NEWS_METHOD } from '../../../shared/newsMethod';
import { escapeHtml as esc, SITE_ORIGIN, completeMeta } from '../../../shared/seo';
import { getNewsIndex } from './newsStore';
export const boardPath = (competition: string) => competition === 'arc-2' ? '/kaggle-leaderboard/arc-2' : '/kaggle-leaderboard';
/** The front-page share card under today's address: ARC Daily pages without a card of their own use it. */
const cardFor = (articles: NewsArticle[]) => ({ image: `${SITE_ORIGIN}${sectionCardPath(articles)}`, imageAlt: sectionCardAlt(articles) });
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
    <h1>${esc(article.headline)}</h1><p>${esc(article.dek)}</p><p>ARC Daily sports desk · Written with GPT-6 Sol</p>
    <p>Published ${timeTag(article.publishedAt, false)}. Board date ${timeTag(article.dataAsOf, false)}. Exact source observations remain in the archived reporting data.</p>
    ${article.sections.map(section => `${section.heading ? `<h2>${esc(section.heading)}</h2>` : ''}${newlineText(section.text)}<p>${section.sourceIds.map(id => { const source = article.sources.find(source => source.id === id)!; return `<a href="${esc(source.url)}">${esc(source.title)}</a>`; }).join(' · ')}</p>`).join('')}
    <h2>From the box score</h2><table><thead><tr><th>Team</th><th>Rank</th><th>Score</th><th>Rank change</th><th>Score change</th></tr></thead><tbody>${article.stats.map(stat => `<tr><td><a href="${competitorPath(`${article.competition}-${stat.teamId}`)}">${esc(stat.name)}</a></td><td>${stat.rank}</td><td>${stat.score}</td><td>${rankChange(stat)}</td><td>${scoreChange(stat)}</td></tr>`).join('')}</tbody></table>
    <p>${esc(article.coverageNote)}</p><p><a href="${boardPath(article.competition)}">Full live ${esc(competitionName(article.competition))} box score</a> · <a href="/news">The ARC Daily Digest front page</a> · <a href="/news/competitors">Competitor notebook</a> · <a href="/api/news/${esc(article.id)}/evidence">Archived reporting data</a></p>
    <h2>Sources</h2>${sourceList(article)}</article></main>`;
  return completeMeta({ title: articleTitle(article), description: articleDescription(article), url, type: 'article', jsonLd, bodyHtml,
    image: `${SITE_ORIGIN}${articleCardPath(article)}`, imageAlt: articleCardAlt(article), imageWidth: NEWS_CARD_WIDTH, imageHeight: NEWS_CARD_HEIGHT,
    publishedTime: article.publishedAt, section: competitionName(article.competition) });
}
const personLink = (person: NewsPerson) => `<a href="${personPath(person.id)}">${esc(person.name)}</a>`;
const rosterHtml = (record: CompetitorRecord, people: NewsPerson[]) => `<ul>${record.members.map(handle => {
  const person = peopleForTeam(people, record).find(item => item.accounts.some(account => account.platform === 'kaggle' && account.handle === handle));
  return `<li>${person ? personLink(person) : `<a href="https://www.kaggle.com/${encodeURIComponent(handle)}">${esc(handle)}</a>`}</li>`;
}).join('')}</ul>`;
function competitorMeta(record: CompetitorRecord, articles: NewsArticle[], people: NewsPerson[]): RouteMetaTags {
  const description = competitorDescription(record);
  const coverage = articles.filter(article => article.competition === record.competition && article.teamIds.includes(record.teamId));
  return completeMeta({ ...ROUTE_META_TAGS['/news/competitors'], ...cardFor(articles), title: competitorTitle(record), description,
    url: `${SITE_ORIGIN}${competitorPath(record.id)}`, bodyHtml: `<main><h1>${esc(record.name)}</h1><p>${esc(description)}</p>
    <p>Competition: ${esc(competitionName(record.competition))}. Team ID: ${esc(record.teamId)}.</p>
    <p>First observed by the newspaper: ${timeTag(record.firstObservedAt, false)}. Last checked: ${timeTag(record.lastObservedAt, false)}. Observation dates are not competition join dates.</p>
    <h2>Public team roster</h2>${rosterHtml(record, people)}
    ${record.aliases.length ? `<h2>Observed names</h2><p>${record.aliases.map(esc).join(', ')}</p>` : ''}
    <h2>What is on the record</h2>${record.facts.length ? record.facts.map(fact => `<p>${esc(fact.text)} <a href="${esc(fact.sourceUrl)}">${esc(fact.sourceTitle)}</a> (checked ${timeTag(fact.checkedAt, false)})</p>`).join('') : '<p>No sourced background notes have been added yet.</p>'}
    <h2>In the paper</h2>${coverage.length ? `<ul>${coverage.map(article => `<li>${articleLink(article)}</li>`).join('')}</ul>` : '<p>Not yet named in an edition.</p>'}
    <p><a href="${boardPath(record.competition)}">Live ${esc(competitionName(record.competition))} box score</a> · <a href="/news/competitors">Competitor notebook</a> · <a href="/news">The ARC Daily Digest front page</a></p></main>` });
}
function peopleMeta(people: NewsPerson[], articles: NewsArticle[], person?: NewsPerson): RouteMetaTags {
  const base = ROUTE_META_TAGS['/news/people'];
  const tags = completeMeta({ ...base, ...cardFor(articles), ...(person ? { title: `${person.name} | ${NEWS_NAME}`, url: `${SITE_ORIGIN}${personPath(person.id)}` } : {}) });
  return { ...tags, jsonLd: collection(tags, (person ? [person] : people).map(item => ({ name: item.name, path: personPath(item.id) }))),
    bodyHtml: `<main><h1>${esc(person?.name ?? 'People behind the teams')}</h1><p>Verified people and dated competition rosters. Observations do not establish joining dates or credit for particular submissions.</p>${person ? `${person.portrait ? `<img src="${esc(person.portrait.src)}" alt="${esc(person.portrait.alt)}" width="176" height="176"/>` : ''}${person.hallOfFame.length ? `<ul>${person.hallOfFame.map(card => `<li><a href="${esc(card.path)}">${esc(card.label)}</a></li>`).join('')}</ul>` : ''}${person.facts.map(fact => `<p>${esc(fact.text)} <a href="${esc(fact.sourceUrl)}">${esc(fact.sourceTitle)}</a></p>`).join('')}<h2>Observed teams</h2><ul>${person.memberships.map(member => `<li>${esc(member.teamName)} (${esc(competitionName(member.competition))}, ${esc(member.season)}) · ${esc(member.memberHandle)} · observed ${timeTag(member.firstObservedAt, false)}–${timeTag(member.lastObservedAt, false)} <a href="${esc(member.sourceUrl)}">Roster source</a></li>`).join('')}</ul><h2>Public accounts</h2><ul>${person.accounts.map(account => `<li><a href="${esc(account.url)}">${esc(account.handle)}</a> · <a href="${esc(account.sourceUrl)}">Identity source</a></li>`).join('')}</ul>${person.hallOfFame.map(card => `<figure><a href="${esc(card.path)}">${card.image ? `<img src="${esc(card.image.src)}" alt="${esc(card.image.alt)}"/>` : ''}${esc(card.label)}</a><figcaption>Historical ARC Hall of Fame artwork.</figcaption></figure>`).join('')}` : `<ul>${people.map(item => `<li>${personLink(item)}${item.hallOfFame.length ? ` · ${item.hallOfFame.map(card => esc(card.label)).join('; ')}` : ''}${item.memberships.length ? ` · ${item.memberships.map(member => `${esc(member.teamName)} (${esc(competitionName(member.competition))}, ${esc(member.season)})`).join('; ')}` : ''}</li>`).join('')}</ul>`}<p><a href="/news">Front page</a> · <a href="/news/people">All people</a></p></main>` };
}
function communityMeta(posts: NewsSocialPost[], articles: NewsArticle[]): RouteMetaTags {
  const tags = completeMeta({ ...ROUTE_META_TAGS['/news/community'], ...cardFor(articles) });
  return { ...tags, jsonLd: collection(tags, posts.map(post => ({ name: `${post.authorName}: ${post.summary}`, path: `/news/community#post-${post.id}` }))),
    bodyHtml: `<main><h1>Around the contests</h1><p>Public research, reactions and friendly banter with original sources. Scores belong to each post's date.</p>${posts.map(post => `<article id="post-${post.id}"><h2><a href="${esc(post.url)}">${esc(post.authorName)} · @${esc(post.author)}</a></h2><p>${esc(post.summary)}</p><p>${esc(post.whyItMatters)}</p>${post.postedAt ? `<p>Posted ${timeTag(post.postedAt)}.</p>` : '<p>Posting time unavailable.</p>'}${post.storyUrl ? `<a href="${esc(post.storyUrl)}">Linked release</a>` : ''}</article>`).join('')}<a href="/news">Front page</a></main>` };
}
function methodMeta(articles: NewsArticle[]): RouteMetaTags {
  return completeMeta({ ...ROUTE_META_TAGS['/news/how-this-is-made'], ...cardFor(articles), bodyHtml: `<main><h1>How This Is Made</h1>${NEWS_METHOD.map(section => `<section><h2>${esc(section.heading)}</h2><p>${esc(section.text)}</p></section>`).join('')}<p><a href="/feedback">Feedback and corrections</a> · <a href="/news">Front page</a></p></main>` });
}
function wireMeta(wire: NewsWireStory[], articles: NewsArticle[]): RouteMetaTags {
  const tags = completeMeta({ ...ROUTE_META_TAGS['/news/wire'], ...cardFor(articles) });
  return { ...tags, jsonLd: collection(tags, wire.map(story => ({ name: story.headline, path: wirePath(story.id) }))),
    bodyHtml: `<main><h1>The wire</h1><p>Short sourced stories on both boards, filed several times a day by the ARC Daily Digest wire desk (GPT-6 Luna). Every figure is checked against the saved board before publication.</p>${wire.map(story => `<article id="${esc(story.id)}"><p>${esc(competitionName(story.competition))} · ${timeTag(story.publishedAt)}</p><h2>${esc(story.headline)}</h2>${story.sections.map(section => `<p>${esc(section.text)}</p>`).join('')}<p>${story.sources.map(source => `<a href="${esc(source.url)}">${esc(source.title)}</a>`).join(' · ')}</p></article>`).join('') || '<p>The wire desk has not filed yet.</p>'}<a href="/news">Front page</a></main>` };
}
function frontPageMeta(articles: NewsArticle[], dispatches: NewsDispatch[], wire: NewsWireStory[]): RouteMetaTags {
  const tags = completeMeta({ ...ROUTE_META_TAGS['/news'], ...cardFor(articles) });
  const dispatchHtml = dispatches.map(dispatch => `<article id="${esc(dispatch.id)}"><p>${esc(competitionName(dispatch.competition))} · ${timeTag(dispatch.publishedAt)}</p><h2>${esc(dispatch.headline)}</h2>${dispatch.image ? `<figure><img src="${esc(dispatch.image.src)}" alt="${esc(dispatch.image.alt)}"/><figcaption>${esc(dispatch.image.caption)}</figcaption></figure>` : ''}${dispatch.sections.map(section => `<p>${esc(section.text)}</p>`).join('')}${dispatch.interpretation ? `<p><strong>The ARC Daily Digest’s take:</strong> ${esc(dispatch.interpretation)}</p>` : ''}<p>${dispatch.sources.map(source => `<a href="${esc(source.url)}">${esc(source.title)}</a>`).join(' · ')}</p></article>`).join('');
  return { ...tags, jsonLd: collection(tags, [...dispatches.map(dispatch => ({ name: dispatch.headline, path: `/news#${dispatch.id}` })), ...articles.map(article => ({ name: article.headline, path: newsArticlePath(article.id) }))]),
    bodyHtml: `<main><h1>${NEWS_NAME}: ARC-AGI-3 and ARC-AGI-2 contest reporting</h1><p>Early (6 am) and late (6 pm Eastern) editions from both Kaggle competitions, short wire stories through the day, and the live public boards: leaders, medal lines, the past day's movers and where past prize winners stand, all from recorded leaderboard observations and cited sources.</p><p><a href="/news/wire">The wire</a> · <a href="/kaggle-leaderboard#medal-race">ARC-AGI-3 medal race graphic</a> · <a href="/kaggle-leaderboard#score-history">ARC-AGI-3 score history</a> · <a href="/kaggle-leaderboard/arc-2#medal-race">ARC-AGI-2 leaderboard</a> · <a href="/arc-leaderboards">All ARC leaderboards</a> · <a href="/human-records.html">Human and AI game records</a> · <a href="/arc3/games">Public game guides</a> · <a href="/hall-of-fame">Illustrated ARC Hall of Fame cards</a> · <a href="https://discord.gg/9b77dPAmcA">ARC Discord</a> · <a href="/news/competitors">Competitor notebook</a> · <a href="/news/feed.xml">RSS feed</a></p>${wire.length ? `<h2>What's news</h2><ul>${wire.slice(0, 8).map(story => `<li><a href="${wirePath(story.id)}">${esc(story.headline)}</a> (${esc(competitionName(story.competition))})</li>`).join('')}</ul>` : ''}${dispatchHtml}${articles.length ? `<h2>Latest editions</h2>${articles.map(article => `<article><p>${kicker(article)}</p><h3>${articleLink(article)}</h3><p>${esc(article.dek)}</p></article>`).join('')}` : '<p>The first edition is being prepared.</p>'}</main>` };
}
function notebookMeta(competitors: CompetitorRecord[], articles: NewsArticle[]): RouteMetaTags {
  const tags = completeMeta({ ...ROUTE_META_TAGS['/news/competitors'], ...cardFor(articles) });
  return { ...tags, jsonLd: collection(tags, competitors.map(record => ({ name: `${record.name} (${competitionName(record.competition)})`, path: competitorPath(record.id) }))),
    bodyHtml: `<main><h1>Competitor notebook</h1><p>Sourced background and observed public team identities. Teams in different competitions have separate records.</p><ul>${competitors.map(record => `<li><a href="${competitorPath(record.id)}">${esc(record.name)}</a> — ${esc(competitionName(record.competition))}</li>`).join('')}</ul><p><a href="/news">Back to the sports page</a></p></main>` };
}
export function resolveNewsMeta(route: string): { tags: RouteMetaTags; status: number } | null {
  if (route !== '/news' && !route.startsWith('/news/')) return null;
  const { articles, competitors, dispatches = [], people = [], social = [], wire = [] } = getNewsIndex();
  if (route === '/news') {
    const tags = frontPageMeta(articles, dispatches, wire);
    return { status: 200, tags };
  }
  if (route === '/news/wire') return { status: 200, tags: wireMeta(wire, articles) };
  if (route === '/news/competitors') return { status: 200, tags: notebookMeta(competitors, articles) };
  if (route === '/news/people') return { status: 200, tags: peopleMeta(people, articles) };
  if (route === '/news/community') return { status: 200, tags: communityMeta(social, articles) };
  if (route === '/news/how-this-is-made') return { status: 200, tags: methodMeta(articles) };
  const personRoute = route.match(/^\/news\/people\/([a-z0-9-]+)$/);
  if (personRoute) { const person = people.find(item => item.id === personRoute[1]); if (person) return { status: 200, tags: peopleMeta(people, articles, person) }; }
  const profile = route.match(/^\/news\/competitors\/([a-z0-9-]+)$/);
  if (profile) { const record = competitors.find(record => record.id === profile[1]); if (record) return { status: 200, tags: competitorMeta(record, articles, people) }; }
  const article = articles.find(article => newsArticlePath(article.id) === route);
  if (article) return { status: 200, tags: newsArticleMeta(article) };
  return { status: 404, tags: completeMeta({ title: `Page not found | ${NEWS_NAME}`, description: 'This newspaper page could not be found. Visit The ARC Daily Digest for current coverage.', url: `${SITE_ORIGIN}${route}`, noindex: true }) };
}
const latest = (values: string[]) => values.reduce<string | undefined>((max, value) => !max || value > max ? value : max, undefined);
/** News URLs with a real last-change time: publication for editions, last check for notebooks. */
export function newsSitemapEntries(): { url: string; lastmod?: string }[] {
  const { articles, competitors, dispatches = [], people = [], social = [], wire = [] } = getNewsIndex();
  return [
    { url: `${SITE_ORIGIN}/news`, lastmod: latest([...articles.map(article => article.publishedAt), ...dispatches.map(dispatch => dispatch.publishedAt), ...wire.map(story => story.publishedAt)]) },
    { url: `${SITE_ORIGIN}/news/wire`, lastmod: latest(wire.map(story => story.publishedAt)) },
    { url: `${SITE_ORIGIN}/news/competitors`, lastmod: latest(competitors.map(record => record.lastObservedAt)) },
    { url: `${SITE_ORIGIN}/news/people`, lastmod: latest(people.flatMap(person => [...person.accounts.map(account => account.checkedAt), ...person.memberships.map(member => member.lastObservedAt)])) },
    { url: `${SITE_ORIGIN}/news/community`, lastmod: latest(social.map(post => post.checkedAt)) },
    { url: `${SITE_ORIGIN}/news/how-this-is-made` },
    ...people.map(person => ({ url: `${SITE_ORIGIN}${personPath(person.id)}`, lastmod: latest([...person.accounts.map(account => account.checkedAt), ...person.memberships.map(member => member.lastObservedAt)]) })),
    ...articles.map(article => ({ url: `${SITE_ORIGIN}${newsArticlePath(article.id)}`, lastmod: article.publishedAt })),
    ...competitors.map(record => ({ url: `${SITE_ORIGIN}${competitorPath(record.id)}`, lastmod: record.lastObservedAt })),
  ];
}
export const newsSitemapUrls = (): string[] => newsSitemapEntries().map(entry => entry.url);
export function newsRss(): string {
  const { articles } = getNewsIndex();
  const feed = `${SITE_ORIGIN}/news/feed.xml`;
  const built = latest(articles.map(article => article.publishedAt));
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>${NEWS_NAME}</title><link>${SITE_ORIGIN}/news</link><atom:link href="${feed}" rel="self" type="application/rss+xml"/><description>Early and late editions on the ARC Prize 2026 ARC-AGI-3 and ARC-AGI-2 Kaggle competitions.</description><language>en</language>${built ? `<lastBuildDate>${new Date(built).toUTCString()}</lastBuildDate>` : ''}<ttl>60</ttl>${articles.slice(0, 40).map(article => {
    const link = `${SITE_ORIGIN}${newsArticlePath(article.id)}`;
    return `<item><title>${esc(article.headline)}</title><link>${link}</link><guid isPermaLink="true">${link}</guid><pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate><category>${esc(competitionName(article.competition))}</category><description>${esc(article.dek)}</description><media:content url="${esc(`${SITE_ORIGIN}${articleCardPath(article)}`)}" medium="image" type="image/png" width="${NEWS_CARD_WIDTH}" height="${NEWS_CARD_HEIGHT}"><media:description>${esc(articleCardAlt(article))}</media:description></media:content></item>`;
  }).join('')}</channel></rss>`;
}
