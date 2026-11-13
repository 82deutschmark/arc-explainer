/**
 * Author: GPT-6 / Codex (reasoning effort not exposed); GPT-6.1 Terra / Codex; GPT-6 / Codex (reasoning effort not exposed); GPT-6 Astra Extra high; GPT-6 / Codex; GPT-6.1 Sol / Codex; GPT-6 Sol / Codex; Claude Opus 5.5 (Bubba); Claude Sonnet 5.5
 * Date: 13-November-2026
 * Permanent special-report links repaired by GPT-6 / Codex, 2026-11-01.
 * 09-Nov-2026 (GPT-6 / Codex): verified story casts and per-contest team card evidence.
 * Updated by GPT-6.1 Terra / Codex (reasoning effort not exposed).
 * PURPOSE: Shareable competitor, sponsor and team card pages with front/back downloads, artwork-led landscape previews, linked rosters,
 *          sourced team and Kaggle history, Cabinet discovery, and server-readable newspaper features,
 *          illustrated article and profile HTML plus genuine NewsArticle
 *          metadata, archive sitemap URLs and RSS, all from the committed newsroom store.
 *          Unpublished article addresses and publication-read failures receive distinct initial HTML and HTTP statuses.
 *          08-Oct-2026: per-article share cards and Open Graph article fields; the front
 *          page and profile are CollectionPages listing their entries; readable Eastern
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
 *          Crawler HTML mirrors the story archive and the front-page Kaggle discussion column.
 * SRP/DRY check: Pass — plain rendering only; content and validation remain in newsStore,
 *          wording and card URLs in shared/news.ts, card pixels in newsCardImage.ts.
 */
import { ON_THE_PRIVATE_ART } from '../../../shared/onThePrivateArt';
import { NEWS_CONTACT, NEWS_TIPS_PATH } from '../../../shared/newsContact';
import { figuresHtml, statScores, statTeamNames } from '../../../shared/newsFigures';
import { type RouteMetaTags, ROUTE_META_TAGS } from '../../../shared/routes';
import {
  type NewsArticle, type NewsDispatch, type NewsSection, type CompetitorRecord, type NewsStat, articleCompetitionLabel, articleFigureStats, newsArticlePath, competitorPath, NEWS_NAME, NEWS_STORY_MISSING, articleStructuredData, dispatchStructuredData, newsPublisher,
  articleTitle, articleDescription, editionFeature, reportedPeople, displayPortrait, articleCardPath, articleCardAlt, competitionName, editionLabel, newsDate, writerCredit, publishedCompetitionOrder, competitionStories,
  competitorTitle, competitorDescription, NEWS_CARD_WIDTH, NEWS_CARD_HEIGHT,
  type NewsPerson, type NewsSocialPost, type NewsDiscussion, type NewsWireStory, personPath, peopleForTeam, wirePath, sectionCardAlt, sectionCardPath, frontPageSocialPosts, recentDiscussions, NEWS_ARCHIVE, publishedStories, archiveMonths,
} from '../../../shared/news';
import { NEWS_PRODUCTION, NEWS_METHOD } from '../../../shared/newsMethod';
import { NEWS_STAFF_PATH, NEWS_STAFF_HEADING, NEWS_STAFF_INTRO, NEWS_HUMAN_EDITOR, NEWS_STAFF_WRITERS, NEWS_STAFF_ARCHIVE_WRITERS, NEWS_STAFF_TOOL_CREDIT, NEWS_EDITOR_CONTACT } from '../../../shared/newsStaff';
import { escapeHtml as esc, SITE_ORIGIN, completeMeta } from '../../../shared/seo';
import { collectionShareVersion, collectionCardPath, collectionCardTitle, collectionCardDescription, collectionEarnedLine, collectionStandingLabel, collectionRoleLabel, collectionShareAlt, collectionSharePath, collectionTeamCompetition, splitTeamCards,
  COLLECTION_SHARE_WIDTH, COLLECTION_SHARE_HEIGHT, type CollectionCard, type CollectionEntry } from '../../../shared/newsCollection';
import { getNewsCollection } from './newsCollection';
import { getNewsIndex, loadNewsArchive } from './newsStore';
import { KAGGLE_COMPETITIONS } from '../../../shared/kaggleCompetitions';
import { NEWS_BRAND } from '../../../shared/newsBrand';
import { uncardedCast } from '../../../shared/cardCast';
export const boardPath = (competition: string) => KAGGLE_COMPETITIONS[competition]?.path ?? '/news';
/** The front-page share card under today's address: ARC Daily pages without a card of their own use it. */
const cardFor = (articles: NewsArticle[]) => ({ image: `${SITE_ORIGIN}${sectionCardPath(articles)}`, imageAlt: sectionCardAlt(articles) });
const articleLink = (article: NewsArticle) => `<a href="${newsArticlePath(article.id)}">${esc(article.headline)}</a>`;
const sourceList = (article: NewsArticle) => `<ol>${article.sources.map(source => `<li id="source-${esc(source.id)}"><a href="${esc(source.url)}">${esc(source.title)}</a></li>`).join('')}</ol>`;
const illustrationHtml = (article: Pick<NewsDispatch, 'image'>) => article.image ? `<figure><img src="${esc(article.image.src)}" alt="${esc(article.image.alt)}"/><figcaption>${esc(article.image.caption)}</figcaption></figure>` : '';
/** Match the article and front-page section order for non-JavaScript readers. */
function sectionExtrasHtml(section: NewsSection): string {
  const picture = section.image ? `<figure><img src="${esc(section.image.src)}" alt="${esc(section.image.alt)}"/><figcaption>${esc(section.image.caption)}</figcaption></figure>` : '';
  const table = section.standings ? `<table><caption>${esc(section.standings.caption)} · <time datetime="${esc(section.standings.observedAt)}">${esc(section.standings.observedAt.replace('T', ' ').replace('Z', ' UTC'))}</time> · provisional</caption><thead><tr><th scope="col">Place</th><th scope="col">Team</th><th scope="col">Score</th></tr></thead><tbody>${section.standings.rows.map(row => `<tr><td class="pl">#${row.rank}</td><td><strong class="news-team-name">${esc(row.name)}</strong></td><td class="sc">${row.score}</td></tr>`).join('')}</tbody></table>` : '';
  return picture + table;
}
const newlineText = (text: string) => text.split(/\n\n+/).map(paragraph => `<p>${esc(paragraph)}</p>`).join('');
const timeTag = (value: string, withTime = true) => `<time datetime="${esc(value)}">${esc(newsDate(value, withTime))}</time>`;
const kicker = (article: NewsArticle) => `${esc(articleCompetitionLabel(article))} · ${esc(editionLabel(article))} · ${timeTag(article.date, false)}`;
const rankChange = (stat: NewsStat) => stat.rankChange == null ? 'Not available' : stat.rankChange === 0 ? 'Unchanged' : `${stat.rankChange > 0 ? 'Up' : 'Down'} ${Math.abs(stat.rankChange)}`;
const scoreChange = (stat: NewsStat) => stat.scoreChange == null ? 'Not available' : `${stat.scoreChange > 0 ? '+' : ''}${stat.scoreChange}`;
/** A CollectionPage whose ItemList names each linked entry, for the two index pages. */
function collection(tags: RouteMetaTags, items: { name: string; path: string }[]): Record<string, unknown> {
  return { '@context': 'https://schema.org', '@graph': [{
    '@type': 'CollectionPage', '@id': tags.url, url: tags.url, name: tags.title, description: tags.description, inLanguage: 'en',
    isPartOf: { '@id': `${SITE_ORIGIN}/#website` }, publisher: newsPublisher(SITE_ORIGIN), ...(tags.image ? { primaryImageOfPage: { '@type': 'ImageObject', url: tags.image, width: NEWS_CARD_WIDTH, height: NEWS_CARD_HEIGHT } } : {}),
    mainEntity: { '@type': 'ItemList', numberOfItems: items.length,
      itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, url: `${SITE_ORIGIN}${item.path}` })) },
  }] };
}
/** The full dispatch, including its own art and sources, stays identical across server views. */
function dispatchHtml(dispatch: NewsDispatch, subjects: NewsPerson[] = []): string {
  return `<article id="${esc(dispatch.id)}"><h2>${esc(dispatch.headline)}</h2>${dispatch.dek ? `<p>${esc(dispatch.dek)}</p>` : ''}<p>${esc(competitionName(dispatch.competition))} · ${timeTag(dispatch.publishedAt)}${dispatch.generatedBy ? ` · ${esc(writerCredit(dispatch.generatedBy))}` : ''}</p>${illustrationHtml(dispatch)}${dispatch.sections.map((section, position) => `${section.heading ? `<h3>${esc(section.heading)}</h3>` : ''}${figuresHtml(section.text, esc).replace(/\n/g, '<br/>')}${position === 0 && subjects.length ? storyPeopleHtml(subjects, dispatch.competition) : ''}${position === 0 && dispatch.id === 'on-the-private' ? `<section><h3>Inside the nightclub</h3><p>The original stills behind the video, from Dries at the microphone to the last dance.</p>${ON_THE_PRIVATE_ART.map(item => `<figure><img src="${esc(item.src)}" alt="${esc(item.caption)}" loading="lazy"><figcaption>${esc(item.caption)}</figcaption></figure>`).join('')}</section><p>These frames show the public leaderboard as it appeared during production; private results remain hidden.</p><p><a href="/news-scene-books/on-the-private/index.html">Open the scene book on its own</a></p><iframe title="On the Private widescreen scene book" src="/news-scene-books/on-the-private/index.html" style="width:100%;height:900px;border:0"></iframe>` : ''}`).join('')}${dispatch.interpretation ? `<p><strong>${esc(NEWS_NAME)}’s take:</strong> ${esc(dispatch.interpretation)}</p>` : ''}${dispatch.commissionedBy ? editorCreditHtml(dispatch.editorNote) : ''}<p>${dispatch.sources.map(source => `<a href="${esc(source.url)}">${esc(source.title)}</a>`).join(' · ')}</p></article>`;
}

export function newsArticleMeta(article: NewsArticle, dispatches: NewsDispatch[] = [], people: NewsPerson[] = []): RouteMetaTags {
  const url = `${SITE_ORIGIN}${newsArticlePath(article.id)}`;
  const jsonLd = articleStructuredData(article, SITE_ORIGIN);
  const feature = editionFeature(article, dispatches);
  const figures = articleFigureStats(article);
  const bodyHtml = `<main><article><p>${kicker(article)}</p>
    <h1>${figuresHtml(article.headline, esc, statScores(figures), [], [...statTeamNames(figures), ...(article.verifiedTeamNames ?? [])])}</h1><p>${figuresHtml(article.dek, esc, statScores(figures), [], [...statTeamNames(figures), ...(article.verifiedTeamNames ?? [])])}</p><p>${esc(NEWS_NAME)} sports desk · ${esc(writerCredit(article.generatedBy))}</p>
    <p>Published ${timeTag(article.publishedAt, false)}. Board date ${timeTag(article.dataAsOf, true)}. Exact source observations remain in the archived reporting data.</p>
    ${feature ? dispatchHtml(feature, reportedPeople([feature, article], people)) : ''}${feature?.image?.src === article.image?.src ? '' : illustrationHtml(article)}
    ${article.sections.map((section, position) => `${section.heading ? `<h2>${esc(section.heading)}</h2>` : ''}${figuresHtml(section.text, esc, statScores(figures), [], [...statTeamNames(figures), ...(article.verifiedTeamNames ?? [])]).replace(/\n/g, '<br/>')}${sectionExtrasHtml(section)}${!feature && position === 0 ? storyPeopleHtml(reportedPeople([article], people), article.competition) : ''}<p>${section.sourceIds.map(id => { const source = article.sources.find(source => source.id === id)!; return `<a href="${esc(source.url)}">${esc(source.title)}</a>`; }).join(' · ')}</p>`).join('')}
    ${article.stats.length ? `<h2>From the box score</h2><table><thead><tr><th>Team</th><th>Rank</th><th>Score</th><th>Rank change</th><th>Score change</th></tr></thead><tbody>${article.stats.map(stat => `<tr><td><a href="${competitorPath(`${article.competition}-${stat.teamId}`)}">${esc(stat.name)}</a></td><td class="pl">#${stat.rank.toLocaleString('en-US')}</td><td class="sc">${stat.score}</td><td>${rankChange(stat)}</td><td class="sd">${scoreChange(stat)}</td></tr>`).join('')}</tbody></table>` : ''}
    <p>${esc(article.coverageNote)}</p><p><a href="${boardPath(article.competition)}">Full live ${esc(competitionName(article.competition))} box score</a> · <a href="/news">${esc(NEWS_NAME)} front page</a> · <a href="/news/cards">Cards</a> · <a href="/api/news/${esc(article.id)}/evidence">Archived reporting data</a></p>
    <h2>Sources</h2>${sourceList(article)}</article></main>`;
  return completeMeta({ title: articleTitle(article), description: articleDescription(article), url, type: 'article', jsonLd, bodyHtml,
    image: `${SITE_ORIGIN}${articleCardPath(article)}`, imageAlt: articleCardAlt(article), imageWidth: NEWS_CARD_WIDTH, imageHeight: NEWS_CARD_HEIGHT,
    publishedTime: article.publishedAt, section: articleCompetitionLabel(article) });
}
const personLink = (person: NewsPerson) => `<a href="${personPath(person.id)}">${esc(person.name)}</a>`;
/** The crawler gets the same subjects and disclosed portrait choices as the browser sidebar. */
function storyPeopleHtml(people: NewsPerson[], competition: NewsArticle['competition']): string {
  const cabinet = getNewsCollection();
  return people.length ? `<aside aria-label="In this story"><h2>In this story</h2>${people.map(person => {
    const portrait = displayPortrait(person);
    const team = [...person.memberships].reverse().find(member => member.competition === competition);
    const card = cabinet.cards.find(item => item.kind === 'person' && item.personId === person.id);
    if (card) return `<article><a href="${esc(card.cardUrl)}"><img src="/api/news/cards/${esc(encodeURIComponent(card.id))}/thumb.webp?side=front&amp;w=300&amp;v=${esc(collectionShareVersion(card))}" alt="${esc(`${person.name}, ${collectionRoleLabel(card).toLowerCase()} card`)}" width="300" height="420"/></a><p>${personLink(person)}${team ? ` · ${esc(team.teamName)}` : ''}</p></article>`;
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
    <h2>Public team roster</h2>${rosterHtml(record, people)}
    ${record.aliases.length ? `<h2>Observed names</h2><p>${record.aliases.map(esc).join(', ')}</p>` : ''}
    <h2>What is on the record</h2>${record.facts.length ? record.facts.map(fact => `<p>${esc(fact.text)} <a href="${esc(fact.sourceUrl)}">${esc(fact.sourceTitle)}</a> (checked ${timeTag(fact.checkedAt, false)})</p>`).join('') : '<p>No sourced background notes have been added yet.</p>'}
    <h2>In the paper</h2>${coverage.length ? `<ul>${coverage.map(article => `<li>${articleLink(article)}</li>`).join('')}</ul>` : '<p>Not yet named in an edition.</p>'}
    <p><a href="${boardPath(record.competition)}">Live ${esc(competitionName(record.competition))} box score</a> · <a href="/news/cards">Cards</a> · <a href="/news">The ARC Daily Digest front page</a></p></main>` });
}
function peopleMeta(people: NewsPerson[], articles: NewsArticle[], person?: NewsPerson): RouteMetaTags {
  const base = ROUTE_META_TAGS['/news/people'];
  const portrait = person && displayPortrait(person);
  const personCards = person ? getNewsCollection().cards.filter(card => card.personId === person.id) : [];
  const cardsHtml = personCards.length ? `<h2>Their cards</h2><ul>${personCards.map(card => `<li><a href="${esc(card.cardUrl)}">${esc(card.season)} card</a></li>`).join('')}</ul>` : '';
  const tags = completeMeta({ ...base, ...cardFor(articles), ...(person ? { title: `${person.name} | ${NEWS_NAME}`, url: `${SITE_ORIGIN}${personPath(person.id)}` } : {}) });
  return { ...tags, jsonLd: collection(tags, (person ? [person] : people).map(item => ({ name: item.name, path: personPath(item.id) }))),
    bodyHtml: `<main><h1>${esc(person?.name ?? 'People behind the teams')}</h1><p>Verified people and dated competition rosters. Observations do not establish joining dates or credit for particular submissions.</p>${person ? `${cardsHtml}${portrait ? `<img src="${esc(portrait.src)}" alt="${esc(portrait.alt)}" width="176" height="176"/>${person.editorialPortrait ? `<p>AI editorial portrait based on <a href="${esc(portrait.sourceUrl)}">${esc(portrait.sourceTitle)}</a>.</p>` : ""}` : ''}${person.hallOfFame.length ? `<ul>${person.hallOfFame.map(card => `<li><a href="${esc(card.path)}">${esc(card.label)}</a></li>`).join('')}</ul>` : ''}${person.facts.map(fact => `<p>${esc(fact.text)} <a href="${esc(fact.sourceUrl)}">${esc(fact.sourceTitle)}</a></p>`).join('')}<h2>Observed teams</h2><ul>${person.memberships.map(member => `<li>${esc(member.teamName)} (${esc(competitionName(member.competition))}, ${esc(member.season)}) · ${esc(member.memberHandle)} · observed ${timeTag(member.firstObservedAt, false)}–${timeTag(member.lastObservedAt, false)} <a href="${esc(member.sourceUrl)}">Roster source</a></li>`).join('')}</ul><h2>Public accounts</h2><ul>${person.accounts.map(account => `<li><a href="${esc(account.url)}">${esc(account.handle)}</a> · <a href="${esc(account.sourceUrl)}">Identity source</a></li>`).join('')}</ul>${person.hallOfFame.map(card => `<figure><a href="${esc(card.path)}">${card.image ? `<img src="${esc(card.image.src)}" alt="${esc(card.image.alt)}"/>` : ''}${esc(card.label)}</a><figcaption>Historical ARC Hall of Fame artwork.</figcaption></figure>`).join('')}` : `<ul>${people.map(item => `<li>${personLink(item)}${item.hallOfFame.length ? ` · ${item.hallOfFame.map(card => esc(card.label)).join('; ')}` : ''}${item.memberships.length ? ` · ${item.memberships.map(member => `${esc(member.teamName)} (${esc(competitionName(member.competition))}, ${esc(member.season)})`).join('; ')}` : ''}</li>`).join('')}</ul>`}<p><a href="/news">Front page</a> · <a href="/news/cards">All cards</a></p></main>` };
}
const discussionsHtml = (threads: NewsDiscussion[]) => `<section id="kaggle-boards"><h2>From the Kaggle boards</h2>${recentDiscussions(threads).map(thread => `<article><h3><a href="${esc(thread.url)}">${esc(thread.title)}</a></h3><p>${esc(competitionName(thread.competition))} · @${esc(thread.author)}</p><p>${esc(thread.summary)}</p><p>Activity ${timeTag(thread.latestActivityAt ?? thread.postedAt!)} · ${thread.commentCount} replies</p></article>`).join('')}</section>`;
function storyArchiveMeta(articles: NewsArticle[], dispatches: NewsDispatch[]): RouteMetaTags {
  const tags = completeMeta({ ...ROUTE_META_TAGS[NEWS_ARCHIVE.path], ...cardFor(articles) });
  const stories = publishedStories(articles, dispatches);
  const groups = archiveMonths(stories).map(([month, entries]) => {
    const rows = entries.map(story => {
      const competition = 'edition' in story ? articleCompetitionLabel(story) : competitionName(story.competition);
      return `<li><article><h3><a href="${esc(newsArticlePath(story.id))}">${esc(story.headline)}</a></h3>${story.dek ? `<p>${esc(story.dek)}</p>` : ''}<p>${timeTag(story.publishedAt, false)} · ${esc(competition)}</p></article></li>`;
    }).join('');
    return `<section><h2>${esc(month)}</h2><ol>${rows}</ol></section>`;
  }).join('');
  return { ...tags, jsonLd: collection(tags, stories.map(story => ({ name: story.headline, path: newsArticlePath(story.id) }))),
    bodyHtml: `<main><h1>${esc(NEWS_ARCHIVE.heading)}</h1><p>${esc(NEWS_ARCHIVE.description)}</p>${groups || '<p>No stories have been published yet.</p>'}<a href="/news">Front page</a></main>` };
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
    bodyHtml: `<main><h1>The wire</h1><p>Source-linked competition developments, dated and credited to their writer. Each story credits its writer. Every figure is checked against the saved board before publication.</p>${wire.map(story => `<article id="${esc(story.id)}"><p>${esc(competitionName(story.competition))} · ${timeTag(story.publishedAt)} · ${esc(writerCredit(story.generatedBy))}</p><h2>${esc(story.headline)}</h2>${story.sections.map(section => `<p>${esc(section.text)}</p>`).join('')}<p>${story.sources.map(source => `<a href="${esc(source.url)}">${esc(source.title)}</a>`).join(' · ')}</p></article>`).join('') || '<p>The wire desk has not filed yet.</p>'}<a href="/news">Front page</a></main>` };
}
function frontPageMeta(articles: NewsArticle[], dispatches: NewsDispatch[], wire: NewsWireStory[], social: NewsSocialPost[], discussions: NewsDiscussion[], people: NewsPerson[] = []): RouteMetaTags {
  const tags = completeMeta({ ...ROUTE_META_TAGS['/news'], ...cardFor(articles) });
  const posts = frontPageSocialPosts(social);
  const socialHtml = posts.length ? `<section><h2>From X</h2><p>Research and reactions around the contests</p>${posts.map(post => `<article><h3><a href="${esc(post.url)}">${esc(post.authorName)} · @${esc(post.author)}</a></h3><p>${esc(post.summary)}</p>${post.postedAt ? `<p>${timeTag(post.postedAt, false)}</p>` : ''}</article>`).join('')}</section>` : '';
  const leadsHtml = publishedCompetitionOrder(articles, dispatches).map(competition => {
    const stories = competitionStories(articles, dispatches, competition), first = stories[0];
    const feature = 'article' in first ? editionFeature(first.article, dispatches) : undefined;
    const storyHtml = 'article' in first
      ? newsArticleMeta(first.article, dispatches, people).bodyHtml!.replace(/^<main>|<\/main>$/g, '').replace(/<h2>/g, '<h3>').replace(/<\/h2>/g, '</h3>').replace(/<h1>/g, '<h2>').replace(/<\/h1>/g, '</h2>')
      : dispatchHtml(first.dispatch, reportedPeople([first.dispatch], people));
    // The server-rendered lead needs the same permanent headline link as the
    // client; the wrapper also marks the actual lead, independently of source links.
    const linked = 'article' in first
      ? storyHtml.replace('<h2>', `<h2><a href="${esc(newsArticlePath(first.id))}">`).replace('</h2>', '</a></h2>')
      : storyHtml;
    return `<section data-news-lead="${esc(first.id)}">${linked}<ul>${stories.slice(1).filter(story => story.id !== feature?.id).slice(0, 3).map(story => `<li><a href="${newsArticlePath(story.id)}">${esc('article' in story ? story.article.headline : story.dispatch.headline)}</a></li>`).join('')}</ul></section>`;
  }).join('');
  return { ...tags, jsonLd: collection(tags, [...dispatches.map(dispatch => ({ name: dispatch.headline, path: newsArticlePath(dispatch.id) })), ...articles.map(article => ({ name: article.headline, path: newsArticlePath(article.id) }))]),
    bodyHtml: `<main><h1>${NEWS_NAME}: ${NEWS_BRAND.goose ? "the sports tabloid of the Kaggleverse" : "ARC-AGI-3 and ARC-AGI-2 contest reporting"}</h1><p>Source-linked competition reporting, meaningful moves and the people behind the teams. Each report preserves its dates and evidence; the linked Kaggle pages provide current standings.</p><p><a href="/news/wire">The wire</a> · <a href="${NEWS_ARCHIVE.path}">${NEWS_ARCHIVE.heading}</a> · <a href="/kaggle-leaderboard#medal-race">ARC-AGI-3 medal race graphic</a> · <a href="/kaggle-leaderboard#score-history">ARC-AGI-3 score history</a> · <a href="/kaggle-leaderboard/arc-2#medal-race">ARC-AGI-2 leaderboard</a> · <a href="/arc-leaderboards">All ARC leaderboards</a> · <a href="/human-records.html">Human and AI game records</a> · <a href="/arc3/games">Public game guides</a> · <a href="/hall-of-fame">Illustrated ARC Hall of Fame cards</a> · <a href="https://discord.gg/9b77dPAmcA">ARC Discord</a> · <a href="/news/cards">Cards</a> · <a href="/news/feed.xml">RSS feed</a> · <a href="${NEWS_STAFF_PATH}">About the Paper</a></p>${socialHtml}${wire.length ? `<h2>What's news</h2><ul>${wire.slice(0, 8).map(story => `<li><a href="${wirePath(story.id)}">${esc(story.headline)}</a> (${esc(competitionName(story.competition))})</li>`).join('')}</ul>` : ''}${discussions.length ? discussionsHtml(recentDiscussions(discussions).slice(0, 3)) : ''}${leadsHtml || '<p>The first edition is being prepared.</p>'}</main>` };
}
function notebookMeta(competitors: CompetitorRecord[], articles: NewsArticle[]): RouteMetaTags {
  const tags = completeMeta({ ...ROUTE_META_TAGS['/news/competitors'], ...cardFor(articles) });
  return { ...tags, jsonLd: collection(tags, competitors.map(record => ({ name: `${record.name} (${competitionName(record.competition)})`, path: competitorPath(record.id) }))),
    bodyHtml: `<main><h1>Competitor profiles</h1><p>Meet the teams, follow their progress, and explore their stories across competitions.</p><ul>${competitors.map(record => `<li><a href="${competitorPath(record.id)}">${esc(record.name)}</a> — ${esc(competitionName(record.competition))}</li>`).join('')}</ul><p><a href="/news">Back to the sports page</a></p></main>` };
}
/** Card pages and the collection list share the same sourced record and links, drawn here as plain HTML for readers and crawlers. */
function collectionEntryHtml(entry: CollectionEntry): string {
  const teamUrl = entry.cardUrl ?? entry.profileUrl;
  const roster = entry.members.length ? `<ul>${entry.members.map(member => `<li><a href="${esc(member.cardUrl ?? (member.personId ? personPath(member.personId) : `https://www.kaggle.com/${encodeURIComponent(member.handle)}`))}">${esc(member.name || member.handle)}</a></li>`).join('')}</ul>` : '';
  const standing = entry.rank == null ? '' : `Rank ${entry.rank}${entry.score != null ? `, score ${entry.score}` : ''} · `;
  return `<section><h3>${esc(competitionName(entry.competition))} · <a href="${esc(teamUrl)}">${esc(entry.teamName)}</a></h3><p>${standing}<a href="${esc(entry.sourceUrl ?? entry.profileUrl)}">${esc(collectionStandingLabel(entry))} ↗</a></p>${roster}</section>`;
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
  const highlights = standalone && card.highlights.length ? `<section><h3>On the record</h3><ul>${card.highlights.map(fact => `<li>${esc(fact.text)} <a href="${esc(fact.sourceUrl)}">Source</a> · as of ${esc(newsDate(fact.checkedAt))}</li>`).join('')}</ul></section>` : '';
  const stories = card.stories.length ? `<section><h3>In the Digest</h3><ul>${card.stories.map(story => `<li><a href="${esc(story.url)}">${esc(story.headline)}</a> · ${esc(newsDate(story.publishedAt))}</li>`).join('')}</ul></section>` : '';
  return `<article id="card-${esc(card.id)}"><${heading}><a href="${esc(card.cardUrl)}">${esc(card.name)}</a></${heading}><p>${esc(collectionRoleLabel(card))} · ${esc(collectionTeamCompetition(card) ?? card.season)}${earned ? ` · Earned this card: ${esc(earned)}` : ''}</p>${card.art ? `<img src="${esc(encodeURI(card.art.src))}" alt="${esc(card.art.alt)}" loading="lazy"/>` : ''}<p>${esc(card.description)}</p>${profile}${highlights}${past}${history}${card.entries.map(collectionEntryHtml).join('')}${rows}${stories}${card.honors.map(honor => `<p><a href="${esc(honor.sourceUrl)}">${esc(honor.label)}</a> · ${esc(honor.season)}</p>`).join('')}${card.accounts.length ? `<section><h3>Accounts</h3><ul>${card.accounts.map(account => `<li><a href="${esc(account.url)}">${esc(account.label)}</a></li>`).join('')}</ul></section>` : ''}<p><a href="${esc(card.profileUrl)}">${card.kind === 'person' ? 'Profile in the Digest' : 'Team profile'}</a> · <a href="${esc(card.cardUrl)}">Share this card</a></p></article>`;
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
    bodyHtml: `<main><p><a href="/news/cards">${NEWS_BRAND.goose ? "All Kaggleverse cards" : "All ARC Prize cards"}</a></p>${collectionCardHtml(card, true)}<p><a href="/news">${esc(NEWS_NAME)}</a></p></main>` });
}
/** A missing publication and a failed read need different status, copy and retry links. */
function unavailableStoryMeta(route: string, failed: boolean): { tags: RouteMetaTags; status: number } {
  const heading = failed ? 'We couldn’t load this story' : NEWS_STORY_MISSING.heading;
  const description = failed
    ? 'The site is temporarily unable to retrieve this article. This is a loading problem; publication status could not be checked.'
    : NEWS_STORY_MISSING.description;
  return { status: failed ? 503 : 404, tags: completeMeta({ title: `${heading} | ${NEWS_NAME}`, description,
    url: `${SITE_ORIGIN}${route}`, noindex: true,
    bodyHtml: `<main><h1>${esc(heading)}</h1><p>${esc(description)}</p><p><a href="${esc(route)}">${failed ? 'Try again' : 'Check again'}</a> · <a href="/news">Read the latest stories →</a></p></main>` }) };
}

export function resolveNewsMeta(route: string): { tags: RouteMetaTags; status: number } | null {
  if (route !== '/news' && !route.startsWith('/news/')) return null;
  const storyRoute = route.match(/^\/news\/([a-z0-9][a-z0-9-]{0,99})$/);
  let archive: ReturnType<typeof loadNewsArchive>;
  try { archive = loadNewsArchive(); }
  catch (error) {
    // Readers must not mistake an unreadable archive for proof that nothing was published.
    if (storyRoute) return unavailableStoryMeta(route, true);
    throw error;
  }
  const { articles, competitors, dispatches = [], people = [], social = [], discussions = [], wire = [] } = archive.index;
  if (route === '/news') {
    const tags = frontPageMeta(articles, dispatches, wire, social, discussions, people);
    return { status: 200, tags };
  }
  if (route === NEWS_TIPS_PATH) return { status: 200, tags: completeMeta({ title: `Talk to me, Goose | ${NEWS_NAME}`, description: 'Send the newsroom a hot tip, an original source or a correction.', url: SITE_ORIGIN + NEWS_TIPS_PATH,
    bodyHtml: `<main><h1>Talk to me, Goose.</h1><p>An upset brewing? A surprise alliance? A bit of public code that changes the race?</p><p>Send us the original link, tell us what changed and when, and point us toward the people who know the story.</p><p><a href="${esc(NEWS_CONTACT.tipUrl)}">${esc(NEWS_CONTACT.tipLabel)}</a></p><p>Corrections are welcome too. Include the story address and the detail we should check.</p><p><a href="${esc(NEWS_CONTACT.communityUrl)}">${esc(NEWS_CONTACT.communityLabel)}</a></p><a href="/news">Back to the paper</a></main>` }) };
  if (route === '/news/wire') return { status: 200, tags: wireMeta(wire, articles) };
  if (route === '/news/cards') {
    const cabinet = getNewsCollection();
    const { people: otherPeople, teams: otherTeams } = uncardedCast({ people, competitors }, cabinet.cards);
    const otherCast = `<details><summary>More people and teams without cards</summary><ul>${otherPeople.map(person => `<li>${personLink(person)}</li>`).join('')}${otherTeams.map(team => `<li><a href="${esc(competitorPath(team.id))}">${esc(team.name)}</a> · ${esc(competitionName(team.competition))}</li>`).join('')}</ul></details>`;
    const tags = completeMeta({ ...ROUTE_META_TAGS['/news/cards'], ...cardFor(articles),
      bodyHtml: `<main><h1>${NEWS_BRAND.goose ? 'Kaggleverse cards' : 'ARC Prize 2026 cards'}</h1><p>${esc(NEWS_NAME)}’s permanent ${esc(cabinet.season)} collection, commissioned by ${esc(cabinet.commissionedBy)}. Every Kaggle competitor, competition sponsor and team has its own numbered card, with shareable links between their records. Standings move until a competition closes; final results come from the private leaderboard.</p>${cabinet.cards.map(card => collectionCardHtml(card)).join('')}${otherCast}<p><a href="/news">${esc(NEWS_NAME)}</a></p></main>` });
    return { status: 200, tags: { ...tags, jsonLd: collection(tags, cabinet.cards.map(card => ({ name: card.name, path: card.cardUrl }))) } };
  }
  const cardRoute = route.match(/^\/news\/cards\/([a-z0-9-]+)$/);
  if (cardRoute) {
    const { cards } = getNewsCollection();
    const card = cards.find(item => item.id === cardRoute[1]);
    if (card) return { status: 200, tags: collectionCardMeta(card) };
    const separated = splitTeamCards(cards, cardRoute[1]);
    if (separated.length) {
      const heading = `${separated[0].name} competition cards`;
      return { status: 200, tags: completeMeta({
        title: `${heading} | ${NEWS_NAME}`, description: 'Choose a competition to see its team roster and standings.', url: SITE_ORIGIN + route,
        bodyHtml: `<main><h1>${esc(heading)}</h1><ul>${separated.map(entry => `<li><a href="${esc(entry.cardUrl)}">${esc(collectionTeamCompetition(entry) ?? entry.name)}</a></li>`).join('')}</ul></main>`,
      }) };
    }
    return { status: 404, tags: completeMeta({ title: `Card not found | ${NEWS_NAME}`, description: 'This card could not be found. Visit the Card Cabinet to browse the collection.', url: `${SITE_ORIGIN}${route}`, noindex: true,
      bodyHtml: '<main><h1>Card not found</h1><p><a href="/news/cards">Browse the Card Cabinet</a></p></main>' }) };
  }
  if (route === '/news/competitors') return { status: 200, tags: notebookMeta(competitors, articles) };
  if (route === '/news/people') return { status: 200, tags: peopleMeta(people, articles) };
  if (route === NEWS_ARCHIVE.path) return { status: 200, tags: storyArchiveMeta(articles, dispatches) };
  if (route === NEWS_STAFF_PATH || route === '/news/how-this-is-made') return { status: 200, tags: staffMeta() };
  const personRoute = route.match(/^\/news\/people\/([a-z0-9-]+)$/);
  if (personRoute) { const person = people.find(item => item.id === personRoute[1]); if (person) return { status: 200, tags: peopleMeta(people, articles, person) }; }
  const profile = route.match(/^\/news\/competitors\/([a-z0-9-]+)$/);
  if (profile) { const record = competitors.find(record => record.id === profile[1]); if (record) return { status: 200, tags: competitorMeta(record, articles, people) }; }
  const article = articles.find(article => newsArticlePath(article.id) === route);
  if (article) return { status: 200, tags: newsArticleMeta(article, dispatches, people) };
  const dispatch = dispatches.find(item => newsArticlePath(item.id) === route);
  if (dispatch) return { status: 200, tags: completeMeta({
    title: `${dispatch.headline} | ${NEWS_NAME}`, description: dispatch.dek ?? dispatch.sections[0]?.text ?? dispatch.headline,
    url: `${SITE_ORIGIN}${route}`, type: 'article', publishedTime: dispatch.publishedAt, section: competitionName(dispatch.competition),
    ...(dispatch.image ? { image: `${SITE_ORIGIN}${dispatch.image.src}`, imageAlt: dispatch.image.alt } : cardFor(articles)),
    jsonLd: dispatchStructuredData(dispatch, SITE_ORIGIN), bodyHtml: `<main>${dispatchHtml(dispatch, reportedPeople([dispatch], people))}</main>`,
  }) };

  if (storyRoute) {
    const rejected = archive.skipped.some(item => ['articles', 'dispatches'].some(folder => item.file === `${folder}/${storyRoute[1]}.json`));
    return unavailableStoryMeta(route, rejected);
  }
  return { status: 404, tags: completeMeta({ title: `Page not found | ${NEWS_NAME}`, description: 'This newspaper page could not be found. Visit the newspaper front page for current coverage.', url: `${SITE_ORIGIN}${route}`, noindex: true }) };
}
const latest = (values: string[]) => values.reduce<string | undefined>((max, value) => !max || value > max ? value : max, undefined);
/** News URLs with a real last-change time: publication for editions, last check for notebooks. */
export function newsSitemapEntries(): { url: string; lastmod?: string }[] {
  const { articles, competitors, dispatches = [], people = [], wire = [] } = getNewsIndex();
  const cabinet = getNewsCollection();
  return [
    { url: `${SITE_ORIGIN}/news`, lastmod: latest([...articles.map(article => article.publishedAt), ...dispatches.map(dispatch => dispatch.publishedAt), ...wire.map(story => story.publishedAt)]) },
    { url: `${SITE_ORIGIN}/news/wire`, lastmod: latest(wire.map(story => story.publishedAt)) },
    { url: `${SITE_ORIGIN}/news/cards`, lastmod: cabinet.updatedAt },
    ...cabinet.cards.map(card => ({ url: `${SITE_ORIGIN}${collectionCardPath(card.id)}`, lastmod: cabinet.updatedAt })),
    { url: `${SITE_ORIGIN}${NEWS_ARCHIVE.path}`, lastmod: publishedStories(articles, dispatches)[0]?.publishedAt },
    { url: `${SITE_ORIGIN}${NEWS_STAFF_PATH}` },
    { url: `${SITE_ORIGIN}${NEWS_TIPS_PATH}` },
    ...people.map(person => ({ url: `${SITE_ORIGIN}${personPath(person.id)}`, lastmod: latest([...person.accounts.map(account => account.checkedAt), ...person.memberships.map(member => member.lastObservedAt)]) })),
    ...dispatches.map(dispatch => ({ url: `${SITE_ORIGIN}${newsArticlePath(dispatch.id)}`, lastmod: dispatch.publishedAt })),
    ...articles.map(article => ({ url: `${SITE_ORIGIN}${newsArticlePath(article.id)}`, lastmod: article.publishedAt })),
    ...competitors.map(record => ({ url: `${SITE_ORIGIN}${competitorPath(record.id)}`, lastmod: record.lastObservedAt })),
  ];
}
export const newsSitemapUrls = (): string[] => newsSitemapEntries().map(entry => entry.url);
/** RSS follows permanent story URLs for both scheduled editions and wiki dispatches. */
export function newsRss(): string {
  const { articles, dispatches = [] } = getNewsIndex();
  const stories = publishedStories(articles, dispatches);
  const feed = `${SITE_ORIGIN}/news/feed.xml`;
  const built = stories[0]?.publishedAt;
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>${esc(NEWS_NAME)}</title><link>${SITE_ORIGIN}/news</link><atom:link href="${feed}" rel="self" type="application/rss+xml"/><description>Source-linked competition news, meaningful moves and the people behind major Kaggle contests.</description><language>en</language>${built ? `<lastBuildDate>${new Date(built).toUTCString()}</lastBuildDate>` : ''}<ttl>60</ttl>${stories.slice(0, 40).map(story => {
    const link = `${SITE_ORIGIN}${newsArticlePath(story.id)}`;
    const edition = 'stats' in story;
    const image = edition ? `${SITE_ORIGIN}${articleCardPath(story)}` : story.image ? `${SITE_ORIGIN}${story.image.src}` : null;
    const alt = edition ? articleCardAlt(story) : story.image?.alt;
    const dimensions = edition ? ` type="image/png" width="${NEWS_CARD_WIDTH}" height="${NEWS_CARD_HEIGHT}"` : '';
    return `<item><title>${esc(story.headline)}</title><link>${link}</link><guid isPermaLink="true">${link}</guid><pubDate>${new Date(story.publishedAt).toUTCString()}</pubDate><category>${esc(competitionName(story.competition))}</category><description>${esc(story.dek ?? story.sections[0]?.text ?? story.headline)}</description>${image ? `<media:content url="${esc(image)}" medium="image"${dimensions}><media:description>${esc(alt ?? story.headline)}</media:description></media:content>` : ''}</item>`;
  }).join('')}</channel></rss>`;
}
