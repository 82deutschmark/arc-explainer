/**
 * Author: GPT-6 / Codex; GPT-6.1 Sol / Codex; GPT-6 Sol / Codex; Claude Opus 5.5 (Bubba); Claude Sonnet 5.5
 * Date: 2026-10-30 (2026-10-29 earlier)
 * PURPOSE: Shareable competitor, sponsor and team card pages with front/back downloads, artwork-led landscape previews, linked rosters,
 *          sourced team and Kaggle history, Cabinet discovery, and server-readable newspaper features,
 *          illustrated article and notebook HTML plus genuine NewsArticle
 *          metadata, archive sitemap URLs and RSS, all from the committed newsroom store.
 *          08-Oct-2026: per-article share cards and Open Graph article fields; the front
 *          page and notebook are CollectionPages listing their entries; readable Eastern
 *          dates and competition names in the crawler body; sitemap lastmod from real
 *          publication/check times; RSS self link, build date, categories and card images.
 *          Front-page crawler text names both contests, their public resources and the
 *          illustrated Hall of Fame; article credits follow each story's recorded writer.
 *          Sourced dispatches, people profiles, public community sources and the unified
 *          newsroom masthead, production cycle and standards also render for crawlers.
 *          09-Oct-2026 (Claude Opus 5.5): person pages lead with the person's portrait and honors.
 *          Later the same day: /news/wire renders the wire desk's stories; the front page's
 *          crawler text describes the rebuilt page (What's News, the board, movers, past winners).
 *          10-Oct-2026 (Claude Sonnet 5.5): every page that shares the front-page card advertises
 *          its versioned address (cardFor), so link-preview services refetch it with each new
 *          day and edition; the front page links to the ARC leaderboards hub.
 *          Crawler HTML mirrors the collected tweet archive and smaller Kaggle discussion column.
 * SRP/DRY check: Pass — plain rendering only; content and validation remain in newsStore,
 *          wording and card URLs in shared/news.ts, card pixels in newsCardImage.ts.
 */
import { type RouteMetaTags, ROUTE_META_TAGS } from '../../../shared/routes';
import {
  type NewsArticle, type NewsDispatch, type CompetitorRecord, type NewsStat, newsArticlePath, competitorPath, NEWS_NAME, articleStructuredData,
  articleTitle, articleDescription, editionFeature, reportedPeople, displayPortrait, articleCardPath, articleCardAlt, competitionName, editionLabel, newsDate, writerCredit,
  competitorTitle, competitorDescription, NEWS_CARD_WIDTH, NEWS_CARD_HEIGHT,
  type NewsPerson, type NewsSocialPost, type NewsDiscussion, type NewsWireStory, personPath, peopleForTeam, wirePath, sectionCardAlt, sectionCardPath, frontPageSocialPosts, chronologicalSocialPosts, recentDiscussions,
} from '../../../shared/news';
import { NEWS_PRODUCTION, NEWS_METHOD } from '../../../shared/newsMethod';
import { NEWS_STAFF_PATH, NEWS_STAFF_HEADING, NEWS_STAFF_INTRO, NEWS_HUMAN_EDITOR, NEWS_STAFF_WRITERS, NEWS_STAFF_ARCHIVE_WRITERS, NEWS_STAFF_TOOL_CREDIT, NEWS_EDITOR_CONTACT } from '../../../shared/newsStaff';
import { escapeHtml as esc, SITE_ORIGIN, completeMeta } from '../../../shared/seo';
import { collectionCardPath, collectionCardTitle, collectionCardDescription, collectionEarnedLine, collectionRoleLabel, collectionShareAlt, collectionSharePath,
  COLLECTION_SHARE_WIDTH, COLLECTION_SHARE_HEIGHT, type CollectionCard, type CollectionEntry } from '../../../shared/newsCollection';
import { getNewsCollection } from './newsCollection';
import { getNewsIndex } from './newsStore';
export const boardPath = (competition: string) => competition === 'arc-2' ? '/kaggle-leaderboard/arc-2' : '/kaggle-leaderboard';
/** The front-page share card under today's address: ARC Daily pages without a card of their own use it. */
const cardFor = (articles: NewsArticle[]) => ({ image: `${SITE_ORIGIN}${sectionCardPath(articles)}`, imageAlt: sectionCardAlt(articles) });
const articleLink = (article: NewsArticle) => `<a href="${newsArticlePath(article.id)}">${esc(article.headline)}</a>`;
const sourceList = (article: NewsArticle) => `<ol>${article.sources.map(source => `<li id="source-${esc(source.id)}"><a href="${esc(source.url)}">${esc(source.title)}</a></li>`).join('')}</ol>`;
const illustrationHtml = (article: Pick<NewsDispatch, 'image'>) => article.image ? `<figure><img src="${esc(article.image.src)}" alt="${esc(article.image.alt)}"/><figcaption>${esc(article.image.caption)}</figcaption></figure>` : '';
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
/** The full dispatch, including its own art and sources, stays identical across server views. */
function dispatchHtml(dispatch: NewsDispatch): string {
  return `<article id="${esc(dispatch.id)}"><p>${esc(competitionName(dispatch.competition))} · ${timeTag(dispatch.publishedAt)}${dispatch.generatedBy ? ` · ${esc(writerCredit(dispatch.generatedBy))}` : ''}</p><h2>${esc(dispatch.headline)}</h2>${illustrationHtml(dispatch)}${dispatch.sections.map(section => `${section.heading ? `<h3>${esc(section.heading)}</h3>` : ''}${newlineText(section.text)}`).join('')}${dispatch.interpretation ? `<p><strong>The ARC Daily Digest’s take:</strong> ${esc(dispatch.interpretation)}</p>` : ''}${dispatch.commissionedBy ? editorCreditHtml(dispatch.editorNote) : ''}<p>${dispatch.sources.map(source => `<a href="${esc(source.url)}">${esc(source.title)}</a>`).join(' · ')}</p></article>`;
}
export function newsArticleMeta(article: NewsArticle, dispatches: NewsDispatch[] = [], people: NewsPerson[] = []): RouteMetaTags {
  const url = `${SITE_ORIGIN}${newsArticlePath(article.id)}`;
  const jsonLd = articleStructuredData(article, SITE_ORIGIN);
  const feature = editionFeature(article, dispatches);
  const bodyHtml = `<main><article><p>${kicker(article)}</p>
    <h1>${esc(article.headline)}</h1><p>${esc(article.dek)}</p>${illustrationHtml(article)}<p>ARC Daily sports desk · ${esc(writerCredit(article.generatedBy))}</p>
    <p>Published ${timeTag(article.publishedAt, false)}. Board date ${timeTag(article.dataAsOf, false)}. Exact source observations remain in the archived reporting data.</p>
    ${feature ? dispatchHtml(feature) : ''}
    ${storyPeopleHtml(reportedPeople(feature ? [feature, article] : [article], people), article.competition)}
    ${article.sections.map(section => `${section.heading ? `<h2>${esc(section.heading)}</h2>` : ''}${newlineText(section.text)}<p>${section.sourceIds.map(id => { const source = article.sources.find(source => source.id === id)!; return `<a href="${esc(source.url)}">${esc(source.title)}</a>`; }).join(' · ')}</p>`).join('')}
    <h2>From the box score</h2><table><thead><tr><th>Team</th><th>Rank</th><th>Score</th><th>Rank change</th><th>Score change</th></tr></thead><tbody>${article.stats.map(stat => `<tr><td><a href="${competitorPath(`${article.competition}-${stat.teamId}`)}">${esc(stat.name)}</a></td><td>${stat.rank}</td><td>${stat.score}</td><td>${rankChange(stat)}</td><td>${scoreChange(stat)}</td></tr>`).join('')}</tbody></table>
    <p>${esc(article.coverageNote)}</p><p><a href="${boardPath(article.competition)}">Full live ${esc(competitionName(article.competition))} box score</a> · <a href="/news">The ARC Daily Digest front page</a> · <a href="/news/competitors">Competitor notebook</a> · <a href="/api/news/${esc(article.id)}/evidence">Archived reporting data</a></p>
    <h2>Sources</h2>${sourceList(article)}</article></main>`;
  return completeMeta({ title: articleTitle(article), description: articleDescription(article), url, type: 'article', jsonLd, bodyHtml,
    image: `${SITE_ORIGIN}${articleCardPath(article)}`, imageAlt: articleCardAlt(article), imageWidth: NEWS_CARD_WIDTH, imageHeight: NEWS_CARD_HEIGHT,
    publishedTime: article.publishedAt, section: competitionName(article.competition) });
}
const personLink = (person: NewsPerson) => `<a href="${personPath(person.id)}">${esc(person.name)}</a>`;
/** The crawler gets the same subjects and disclosed portrait choices as the browser sidebar. */
function storyPeopleHtml(people: NewsPerson[], competition: NewsArticle['competition']): string {
  return people.length ? `<aside aria-label="In this story"><h2>In this story</h2>${people.map(person => {
    const portrait = displayPortrait(person);
    const team = [...person.memberships].reverse().find(member => member.competition === competition);
    return `<article>${portrait ? `<img src="${esc(portrait.src)}" alt="${esc(portrait.alt)}" width="76" height="88"/>` : ''}${personLink(person)}${team ? `<p>${esc(team.teamName)}</p>` : ''}${person.hallOfFame[0] ? `<p>${esc(person.hallOfFame[0].label)}</p>` : ''}${person.editorialPortrait ? '<p>AI editorial portrait</p>' : ''}</article>`;
  }).join('')}</aside>` : '';
}
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
  const portrait = person && displayPortrait(person);
  const tags = completeMeta({ ...base, ...cardFor(articles), ...(person ? { title: `${person.name} | ${NEWS_NAME}`, url: `${SITE_ORIGIN}${personPath(person.id)}` } : {}) });
  return { ...tags, jsonLd: collection(tags, (person ? [person] : people).map(item => ({ name: item.name, path: personPath(item.id) }))),
    bodyHtml: `<main><h1>${esc(person?.name ?? 'People behind the teams')}</h1><p>Verified people and dated competition rosters. Observations do not establish joining dates or credit for particular submissions.</p>${person ? `${portrait ? `<img src="${esc(portrait.src)}" alt="${esc(portrait.alt)}" width="176" height="176"/>${person.editorialPortrait ? `<p>AI editorial portrait based on <a href="${esc(portrait.sourceUrl)}">${esc(portrait.sourceTitle)}</a>.</p>` : ""}` : ''}${person.hallOfFame.length ? `<ul>${person.hallOfFame.map(card => `<li><a href="${esc(card.path)}">${esc(card.label)}</a></li>`).join('')}</ul>` : ''}${person.facts.map(fact => `<p>${esc(fact.text)} <a href="${esc(fact.sourceUrl)}">${esc(fact.sourceTitle)}</a></p>`).join('')}<h2>Observed teams</h2><ul>${person.memberships.map(member => `<li>${esc(member.teamName)} (${esc(competitionName(member.competition))}, ${esc(member.season)}) · ${esc(member.memberHandle)} · observed ${timeTag(member.firstObservedAt, false)}–${timeTag(member.lastObservedAt, false)} <a href="${esc(member.sourceUrl)}">Roster source</a></li>`).join('')}</ul><h2>Public accounts</h2><ul>${person.accounts.map(account => `<li><a href="${esc(account.url)}">${esc(account.handle)}</a> · <a href="${esc(account.sourceUrl)}">Identity source</a></li>`).join('')}</ul>${person.hallOfFame.map(card => `<figure><a href="${esc(card.path)}">${card.image ? `<img src="${esc(card.image.src)}" alt="${esc(card.image.alt)}"/>` : ''}${esc(card.label)}</a><figcaption>Historical ARC Hall of Fame artwork.</figcaption></figure>`).join('')}` : `<ul>${people.map(item => `<li>${personLink(item)}${item.hallOfFame.length ? ` · ${item.hallOfFame.map(card => esc(card.label)).join('; ')}` : ''}${item.memberships.length ? ` · ${item.memberships.map(member => `${esc(member.teamName)} (${esc(competitionName(member.competition))}, ${esc(member.season)})`).join('; ')}` : ''}</li>`).join('')}</ul>`}<p><a href="/news">Front page</a> · <a href="/news/people">All people</a></p></main>` };
}
const discussionsHtml = (threads: NewsDiscussion[]) => `<section id="kaggle-boards"><h2>From the Kaggle boards</h2>${recentDiscussions(threads).map(thread => `<article><h3><a href="${esc(thread.url)}">${esc(thread.title)}</a></h3><p>${esc(competitionName(thread.competition))} · @${esc(thread.author)}</p><p>${esc(thread.summary)}</p><p>Activity ${timeTag(thread.latestActivityAt ?? thread.postedAt!)} · ${thread.commentCount} replies</p></article>`).join('')}</section>`;
function communityMeta(posts: NewsSocialPost[], articles: NewsArticle[], discussions: NewsDiscussion[]): RouteMetaTags {
  const tags = completeMeta({ ...ROUTE_META_TAGS['/news/community'], ...cardFor(articles) });
  return { ...tags, jsonLd: collection(tags, posts.map(post => ({ name: `${post.authorName}: ${post.summary}`, path: `/news/community#post-${post.id}` }))),
    bodyHtml: `<main><h1>Around the contests</h1><section id="tweet-archive"><h2>From X — the collected archive</h2><p>Collected public posts from the past 30 days, newest first, with original sources. Scores belong to each post's date.</p>${chronologicalSocialPosts(posts).map(post => `<article id="post-${post.id}"><h2><a href="${esc(post.url)}">${esc(post.authorName)} · @${esc(post.author)}</a></h2><p>${esc(post.summary)}</p><p>${esc(post.whyItMatters)}</p>${post.postedAt ? `<p>Posted ${timeTag(post.postedAt)}.</p>` : '<p>Posting time unavailable.</p>'}${post.storyUrl ? `<a href="${esc(post.storyUrl)}">Linked release</a>` : ''}</article>`).join('')}</section>${discussionsHtml(discussions)}<a href="/news">Front page</a></main>` };
}
function editorCreditHtml(note?: string): string {
  const editor = NEWS_HUMAN_EDITOR;
  return `<aside class="news-editor-credit"><a href="${esc(editor.portrait.src)}"><img src="${esc(editor.portrait.src)}" alt="${esc(editor.portrait.alt)}" width="112" height="112"/></a><div><strong>Commissioned by <a href="${NEWS_STAFF_PATH}">${esc(editor.name)}</a></strong><span>${esc(editor.role)}</span>${note ? `<p>${esc(note)}</p>` : ''}<small>Editorial portrait · <a href="${NEWS_STAFF_PATH}">About the Paper</a></small></div></aside>`;
}
function staffMeta(): RouteMetaTags {
  const editor = NEWS_HUMAN_EDITOR;
  return completeMeta({ ...ROUTE_META_TAGS[NEWS_STAFF_PATH], bodyHtml: `<main><h1>${esc(NEWS_STAFF_HEADING)}</h1><p>${esc(NEWS_STAFF_INTRO)}</p>
    <section id="staff"><h2>The masthead</h2><figure><img src="${esc(editor.portrait.src)}" alt="${esc(editor.portrait.alt)}" width="320" height="320"/><figcaption>${esc(editor.portrait.caption)}</figcaption></figure><h3>${esc(editor.name)}</h3><p>${esc(editor.role)}</p><p>${esc(editor.description)}</p><p><a href="/news/people/mark-barney">Kaggle competitor profile</a></p>
    <h3>The reporting desks</h3><dl>${NEWS_STAFF_WRITERS.map(writer => `<dt>${esc(writer.name)} · ${esc(writer.role)}</dt><dd>${esc(writer.description)}</dd>`).join('')}</dl><h3>Earlier bylines and contributors</h3>${NEWS_STAFF_ARCHIVE_WRITERS.map(writer => `<p><strong>${esc(writer.name)}.</strong> ${esc(writer.description)}</p>`).join('')}<p>${esc(NEWS_STAFF_TOOL_CREDIT)}</p></section>
    <section id="news-cycle"><h2>From the boards to the edition</h2><ol>${NEWS_PRODUCTION.map(step => `<li><h3>${esc(step.heading)}</h3><p>${esc(step.text)}</p></li>`).join('')}</ol></section>
    <section id="standards"><h2>Our reporting standards</h2>${NEWS_METHOD.map(section => `<h3>${esc(section.heading)}</h3><p>${esc(section.text)}</p>`).join('')}</section>
    <section id="contact"><h2>Reach the editor</h2><p>Send a story tip, correction, retraction request or complaint to Mark on <a href="${esc(NEWS_EDITOR_CONTACT.xUrl)}">X</a> or in the <a href="${esc(NEWS_EDITOR_CONTACT.discordUrl)}">ARC Discord</a>. Please include the story link and any supporting source.</p><p><a href="/feedback">ARC Explainer feedback</a></p></section><p><a href="/news">Front page</a></p></main>` });
}
function wireMeta(wire: NewsWireStory[], articles: NewsArticle[]): RouteMetaTags {
  const tags = completeMeta({ ...ROUTE_META_TAGS['/news/wire'], ...cardFor(articles) });
  return { ...tags, jsonLd: collection(tags, wire.map(story => ({ name: story.headline, path: wirePath(story.id) }))),
    bodyHtml: `<main><h1>The wire</h1><p>Short sourced stories from both boards, checked every two hours by the ARC Daily Digest wire desk. Each story credits its writer. Every figure is checked against the saved board before publication.</p>${wire.map(story => `<article id="${esc(story.id)}"><p>${esc(competitionName(story.competition))} · ${timeTag(story.publishedAt)} · ${esc(writerCredit(story.generatedBy))}</p><h2>${esc(story.headline)}</h2>${story.sections.map(section => `<p>${esc(section.text)}</p>`).join('')}<p>${story.sources.map(source => `<a href="${esc(source.url)}">${esc(source.title)}</a>`).join(' · ')}</p></article>`).join('') || '<p>The wire desk has not filed yet.</p>'}<a href="/news">Front page</a></main>` };
}
function frontPageMeta(articles: NewsArticle[], dispatches: NewsDispatch[], wire: NewsWireStory[], social: NewsSocialPost[], discussions: NewsDiscussion[]): RouteMetaTags {
  const tags = completeMeta({ ...ROUTE_META_TAGS['/news'], ...cardFor(articles) });
  const posts = frontPageSocialPosts(social);
  const socialHtml = posts.length ? `<section><h2>From X</h2><p>Research and reactions around the contests</p>${posts.map(post => `<article><h3><a href="${esc(post.url)}">${esc(post.authorName)} · @${esc(post.author)}</a></h3><p>${esc(post.summary)}</p>${post.postedAt ? `<p>${timeTag(post.postedAt, false)}</p>` : ''}</article>`).join('')}<a href="/news/community#tweet-archive">Browse the collected tweet archive</a></section>` : '';
  const dispatchesHtml = dispatches.map(dispatchHtml).join('');
  return { ...tags, jsonLd: collection(tags, [...dispatches.map(dispatch => ({ name: dispatch.headline, path: `/news#${dispatch.id}` })), ...articles.map(article => ({ name: article.headline, path: newsArticlePath(article.id) }))]),
    bodyHtml: `<main><h1>${NEWS_NAME}: ARC-AGI-3 and ARC-AGI-2 contest reporting</h1><p>Early (6 am) and late (6 pm Eastern) editions from both Kaggle competitions, short wire stories through the day, and the live public boards: leaders, medal lines, the past day's movers and where past prize winners stand, all from recorded leaderboard observations and cited sources.</p><p><a href="/news/wire">The wire</a> · <a href="/kaggle-leaderboard#medal-race">ARC-AGI-3 medal race graphic</a> · <a href="/kaggle-leaderboard#score-history">ARC-AGI-3 score history</a> · <a href="/kaggle-leaderboard/arc-2#medal-race">ARC-AGI-2 leaderboard</a> · <a href="/arc-leaderboards">All ARC leaderboards</a> · <a href="/human-records.html">Human and AI game records</a> · <a href="/arc3/games">Public game guides</a> · <a href="/hall-of-fame">Illustrated ARC Hall of Fame cards</a> · <a href="https://discord.gg/9b77dPAmcA">ARC Discord</a> · <a href="/news/competitors">Competitor notebook</a> · <a href="/news/feed.xml">RSS feed</a> · <a href="${NEWS_STAFF_PATH}">About the Paper</a></p>${socialHtml}${wire.length ? `<h2>What's news</h2><ul>${wire.slice(0, 8).map(story => `<li><a href="${wirePath(story.id)}">${esc(story.headline)}</a> (${esc(competitionName(story.competition))})</li>`).join('')}</ul>` : ''}${discussions.length ? discussionsHtml(recentDiscussions(discussions).slice(0, 3)) : ''}${dispatchesHtml}${articles.length ? `<h2>Latest editions</h2>${articles.map(article => `<article><p>${kicker(article)}</p><h3>${articleLink(article)}</h3>${illustrationHtml(article)}<p>${esc(article.dek)}</p></article>`).join('')}` : '<p>The first edition is being prepared.</p>'}</main>` };
}
function notebookMeta(competitors: CompetitorRecord[], articles: NewsArticle[]): RouteMetaTags {
  const tags = completeMeta({ ...ROUTE_META_TAGS['/news/competitors'], ...cardFor(articles) });
  return { ...tags, jsonLd: collection(tags, competitors.map(record => ({ name: `${record.name} (${competitionName(record.competition)})`, path: competitorPath(record.id) }))),
    bodyHtml: `<main><h1>Competitor notebook</h1><p>Sourced background and observed public team identities. Teams in different competitions have separate records.</p><ul>${competitors.map(record => `<li><a href="${competitorPath(record.id)}">${esc(record.name)}</a> — ${esc(competitionName(record.competition))}</li>`).join('')}</ul><p><a href="/news">Back to the sports page</a></p></main>` };
}
/** Card pages and the collection list share the same sourced record and links, drawn here as plain HTML for readers and crawlers. */
function collectionEntryHtml(entry: CollectionEntry): string {
  if (entry.status === 'unavailable') return '';
  const teamUrl = entry.cardUrl ?? entry.profileUrl;
  const roster = entry.members.length ? `<ul>${entry.members.map(member => `<li><a href="${esc(member.cardUrl ?? (member.personId ? personPath(member.personId) : `https://www.kaggle.com/${encodeURIComponent(member.handle)}`))}">${esc(member.name || member.handle)}</a></li>`).join('')}</ul>` : '';
  const standing = entry.rank == null ? '' : `Rank ${entry.rank}${entry.score != null ? `, score ${entry.score}` : ''} · `;
  return `<section><h3>${esc(competitionName(entry.competition))} · <a href="${esc(teamUrl)}">${esc(entry.teamName)}</a></h3><p>${standing}${entry.status === 'final' ? 'Final result' : 'Live standing'}${entry.observedAt ? ` as of ${esc(newsDate(entry.observedAt))}` : ''}</p>${entry.sourceUrl ? `<p><a href="${esc(entry.sourceUrl)}">Leaderboard</a></p>` : ''}${roster}</section>`;
}
function collectionCardHtml(card: CollectionCard, standalone = false): string {
  const heading = standalone ? 'h1' : 'h2';
  const earned = collectionEarnedLine(card);
  const career = card.career;
  const medals = career?.medals;
  const profile = career && (career.tier || medals || career.rank?.current || career.joinedYear || career.organisation)
    ? `<section><h3>Kaggle profile</h3><ul>${[career.tier ? `Competitions tier: ${career.tier}` : '', medals ? `Medals: ${medals.gold} gold, ${medals.silver} silver, ${medals.bronze} bronze` : '',
      career.rank?.current ? `Overall rank: ${career.rank.current}${career.rank.outOf ? ` of ${career.rank.outOf}` : ''}${career.rank.best ? `, best ${career.rank.best}` : ''}` : '',
      career.joinedYear ? `On Kaggle since ${career.joinedYear}` : '', career.organisation ? `Organisation: ${career.organisation}` : ''].filter(Boolean).map(line => `<li>${esc(line)}</li>`).join('')}<li><a href="${esc(career.profileUrl)}">Kaggle profile</a></li></ul></section>` : '';
  const past = card.pastCards.length ? `<section><h3>Earlier cards</h3><ul>${card.pastCards.map(item => `<li><a href="${esc(item.hallOfFameUrl)}">${esc(item.season ?? 'Earlier')} · ${esc(item.label)}</a>${item.imageSrc ? ` <img src="${esc(encodeURI(item.imageSrc))}" alt="${esc(item.imageAlt)}" loading="lazy"/>` : ''}</li>`).join('')}</ul></section>` : '';
  const history = card.teamHistory.length ? `<section><h3>Teams</h3><ul>${card.teamHistory.map(team => `<li><a href="${esc(team.cardUrl ?? team.profileUrl)}">${esc(team.teamName)}</a> · ${esc(competitionName(team.competition))} ${esc(team.season)}${team.status === 'previous' ? ' · earlier team' : ''}</li>`).join('')}</ul></section>` : '';
  const rows = career?.rows.length ? `<section><h3>Completed Kaggle competitions</h3><ul>${[...career.rows].sort((a, b) => a.rank / a.fieldSize - b.rank / b.fieldSize).slice(0, 14).map(row => `<li><a href="${esc(row.competitionUrl)}">${esc(row.competition)}</a>${row.year ? ` (${row.year})` : ''} · ${row.rank} of ${row.fieldSize}${row.medal ? ` · ${row.medal} medal` : ''}</li>`).join('')}</ul></section>` : '';
  const stories = card.stories.length ? `<section><h3>In the Digest</h3><ul>${card.stories.map(story => `<li><a href="${esc(story.url)}">${esc(story.headline)}</a> · ${esc(newsDate(story.publishedAt))}</li>`).join('')}</ul></section>` : '';
  return `<article id="card-${esc(card.id)}"><${heading}><a href="${esc(card.cardUrl)}">${esc(card.number)} · ${esc(card.name)}</a></${heading}><p>${esc(collectionRoleLabel(card))} · ${esc(card.season)}${earned ? ` · Earned this card: ${esc(earned)}` : ''}</p>${card.art ? `<img src="${esc(encodeURI(card.art.src))}" alt="${esc(card.art.alt)}" loading="lazy"/>` : ''}<p>${esc(card.description)}</p>${profile}${past}${history}${card.entries.map(collectionEntryHtml).join('')}${rows}${stories}${card.honors.map(honor => `<p><a href="${esc(honor.sourceUrl)}">${esc(honor.label)}</a> · ${esc(honor.season)}</p>`).join('')}${card.accounts.length ? `<section><h3>Accounts</h3><ul>${card.accounts.map(account => `<li><a href="${esc(account.url)}">${esc(account.label)}</a></li>`).join('')}</ul></section>` : ''}<p><a href="${esc(card.profileUrl)}">${card.kind === 'person' ? 'Profile in the Digest' : 'Team notebook'}</a> · <a href="${esc(card.cardUrl)}">Share this card</a></p></article>`;
}
function collectionCardMeta(card: CollectionCard): RouteMetaTags {
  const title = collectionCardTitle(card);
  const description = collectionCardDescription(card);
  const url = `${SITE_ORIGIN}${card.cardUrl}`;
  const image = `${SITE_ORIGIN}${collectionSharePath(card)}`;
  return completeMeta({ title, description, url, image, imageAlt: collectionShareAlt(card), imageWidth: COLLECTION_SHARE_WIDTH, imageHeight: COLLECTION_SHARE_HEIGHT,
    jsonLd: { '@context': 'https://schema.org', '@graph': [{ '@type': 'WebPage', '@id': url, url, name: title, description,
      isPartOf: { '@id': `${SITE_ORIGIN}/news/cards` }, primaryImageOfPage: { '@type': 'ImageObject', url: image, width: COLLECTION_SHARE_WIDTH, height: COLLECTION_SHARE_HEIGHT },
      mainEntity: { '@type': card.kind === 'person' ? 'Person' : 'Organization', name: card.name, url } }] },
    bodyHtml: `<main><p><a href="/news/cards">All ARC Prize cards</a></p>${collectionCardHtml(card, true)}<p><a href="/news">The ARC Daily Digest</a></p></main>` });
}
export function resolveNewsMeta(route: string): { tags: RouteMetaTags; status: number } | null {
  if (route !== '/news' && !route.startsWith('/news/')) return null;
  const { articles, competitors, dispatches = [], people = [], social = [], socialArchive = [], discussions = [], wire = [] } = getNewsIndex();
  if (route === '/news') {
    const tags = frontPageMeta(articles, dispatches, wire, social, discussions);
    return { status: 200, tags };
  }
  if (route === '/news/wire') return { status: 200, tags: wireMeta(wire, articles) };
  if (route === '/news/cards') {
    const cabinet = getNewsCollection();
    const tags = completeMeta({ ...ROUTE_META_TAGS['/news/cards'], ...cardFor(articles),
      bodyHtml: `<main><h1>ARC Prize 2026 cards</h1><p>The ARC Daily Digest’s permanent ${esc(cabinet.season)} collection, commissioned by ${esc(cabinet.commissionedBy)}. Every Kaggle competitor, competition sponsor and team has its own numbered card, with shareable links between their records. Standings move until a competition closes; final results come from the private leaderboard.</p>${cabinet.cards.map(card => collectionCardHtml(card)).join('')}<p><a href="/news">The ARC Daily Digest</a></p></main>` });
    return { status: 200, tags: { ...tags, jsonLd: collection(tags, cabinet.cards.map(card => ({ name: card.name, path: card.cardUrl }))) } };
  }
  const cardRoute = route.match(/^\/news\/cards\/([a-z0-9-]+)$/);
  if (cardRoute) {
    const card = getNewsCollection().cards.find(item => item.id === cardRoute[1]);
    if (card) return { status: 200, tags: collectionCardMeta(card) };
    return { status: 404, tags: completeMeta({ title: `Card not found | ${NEWS_NAME}`, description: 'This card could not be found. Visit the Card Cabinet to browse the collection.', url: `${SITE_ORIGIN}${route}`, noindex: true,
      bodyHtml: '<main><h1>Card not found</h1><p><a href="/news/cards">Browse every ARC Prize card</a></p></main>' }) };
  }
  if (route === '/news/competitors') return { status: 200, tags: notebookMeta(competitors, articles) };
  if (route === '/news/people') return { status: 200, tags: peopleMeta(people, articles) };
  if (route === '/news/community') return { status: 200, tags: communityMeta(socialArchive, articles, discussions) };
  if (route === NEWS_STAFF_PATH || route === '/news/how-this-is-made') return { status: 200, tags: staffMeta() };
  const personRoute = route.match(/^\/news\/people\/([a-z0-9-]+)$/);
  if (personRoute) { const person = people.find(item => item.id === personRoute[1]); if (person) return { status: 200, tags: peopleMeta(people, articles, person) }; }
  const profile = route.match(/^\/news\/competitors\/([a-z0-9-]+)$/);
  if (profile) { const record = competitors.find(record => record.id === profile[1]); if (record) return { status: 200, tags: competitorMeta(record, articles, people) }; }
  const article = articles.find(article => newsArticlePath(article.id) === route);
  if (article) return { status: 200, tags: newsArticleMeta(article, dispatches, people) };
  return { status: 404, tags: completeMeta({ title: `Page not found | ${NEWS_NAME}`, description: 'This newspaper page could not be found. Visit The ARC Daily Digest for current coverage.', url: `${SITE_ORIGIN}${route}`, noindex: true }) };
}
const latest = (values: string[]) => values.reduce<string | undefined>((max, value) => !max || value > max ? value : max, undefined);
/** News URLs with a real last-change time: publication for editions, last check for notebooks. */
export function newsSitemapEntries(): { url: string; lastmod?: string }[] {
  const { articles, competitors, dispatches = [], people = [], social = [], socialArchive = [], discussions = [], wire = [] } = getNewsIndex();
  const cabinet = getNewsCollection();
  return [
    { url: `${SITE_ORIGIN}/news`, lastmod: latest([...articles.map(article => article.publishedAt), ...dispatches.map(dispatch => dispatch.publishedAt), ...wire.map(story => story.publishedAt)]) },
    { url: `${SITE_ORIGIN}/news/wire`, lastmod: latest(wire.map(story => story.publishedAt)) },
    { url: `${SITE_ORIGIN}/news/competitors`, lastmod: latest(competitors.map(record => record.lastObservedAt)) },
    { url: `${SITE_ORIGIN}/news/people`, lastmod: latest(people.flatMap(person => [...person.accounts.map(account => account.checkedAt), ...person.memberships.map(member => member.lastObservedAt)])) },
    { url: `${SITE_ORIGIN}/news/cards`, lastmod: cabinet.updatedAt },
    ...cabinet.cards.map(card => ({ url: `${SITE_ORIGIN}${collectionCardPath(card.id)}`, lastmod: cabinet.updatedAt })),
    { url: `${SITE_ORIGIN}/news/community`, lastmod: latest([...socialArchive.map(post => post.checkedAt), ...discussions.map(thread => thread.checkedAt)]) },
    { url: `${SITE_ORIGIN}${NEWS_STAFF_PATH}` },
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
