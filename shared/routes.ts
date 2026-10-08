/**
 * Author: GPT-6 / Codex
 * Date: 2026-10-07
 * PURPOSE: Centralized route meta tags configuration for social media link unfurling and
 *          search. Imported by server middleware for meta tag injection.
 *          2026-10-06: entries can now carry keywords, structured data (JSON-LD) and a
 *          crawlable HTML summary that is served inside #root until the app renders, so a
 *          crawler that does not run JavaScript still sees a real page. Added /analytics
 *          (ARC Prize links to it) and /kaggle-leaderboard; root copy follows the
 *          landing page's 05-Oct pivot to the leaderboard.
 * SRP/DRY check: Pass - Single source of truth for route meta tags
 */

export interface RouteMetaTags {
  title: string;
  description: string;
  url: string;
  image?: string;
  type?: string;
  /** Comma-separated search keywords for this page. */
  keywords?: string;
  /** schema.org structured data, emitted as one application/ld+json script. */
  jsonLd?: Record<string, unknown>;
  /**
   * Plain, crawlable HTML for the page, served inside #root and replaced the moment the
   * app renders. Must describe what the page actually shows -- no figures that would go
   * stale, since nobody reviews this copy (see the ROOT_META note below).
   */
  bodyHtml?: string;
}

const SITE = 'https://arc.markbarney.net';
const WEBSITE_REF = { '@type': 'WebSite', name: 'ARC Explainer', url: `${SITE}/` };
function breadcrumb(name: string, path: string) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'ARC Explainer', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name, item: `${SITE}${path}` },
    ],
  };
}

/**
 * Route meta tags for link unfurling (Discord, Twitter, Slack, etc.)
 * Organized by feature area - add new routes near related routes
 */
export const ROUTE_META_TAGS: Record<string, RouteMetaTags> = {
  '/home': {
    title: 'ARC Explainer Resource Hub — games, guides and results',
    description: 'Find Human ARC, Space Force Mission Control, ARC-AGI-3 game guides, human and AI results, and archived benchmark analyses.',
    url: `${SITE}/home`,
    type: 'website',
    bodyHtml: '<h1>ARC Explainer Resource Hub</h1><p>Independent community games, guides and results by Mark Barney.</p><ul><li><a href="/human-arc/">Human ARC puzzles and assessments</a></li><li><a href="https://sfmc.markbarney.net/">Space Force Mission Control</a></li><li><a href="/arc3/games">ARC-AGI-3 game guides</a></li><li><a href="/human-records.html">Human and AI results</a></li><li><a href="/analytics">Hugging Face results archive</a></li></ul>',
  },
  // ==================== ARC-AGI-3 ====================
  // Keyed by host for "/" because the root differs per host: arc3.markbarney.net is the
  // synthetic-programme landing, arc.markbarney.net leads with the task gallery.
  '/arc3/games': {
    title: 'ARC-AGI-3 Game Mechanics - every official game, explained',
    description:
      'Full mechanics for all 25 official ARC-AGI-3 games: what each one is, what every '
      + 'action does, how it is won. Traced from the game sources so you do not have to.',
    url: 'https://arc.markbarney.net/arc3/games',
    // r11l's opening frame: the busiest of the official set at a glance, and an official
    // game is the right picture here because this page is about the official games --
    // unlike /arc3/gallery below, which is ours and must not lead with somebody else's work.
    image: 'https://arc.markbarney.net/api/arc3/og-image/r11l',
    type: 'website',
  },

  '/arc3/gallery': {
    title: 'ARC-AGI-3 Tasks — play one, no instructions',
    description:
      'Interactive reasoning tasks that explain nothing. Easy for a person, very hard for '
      + 'the best AI. Pick one and work out what it does.',
    url: 'https://arc.markbarney.net/arc3/gallery',
    // OUR game, not an official one. This was ls20-9607627b -- an ARC Prize Foundation
    // task -- so every share of this site led with somebody else's work as the picture.
    // g012 is from the reviewed set and has the busiest opening frame of the fifty
    // (10 colours) which is what survives being shrunk to a share-card thumbnail.
    image: 'https://arc.markbarney.net/api/arc3-mirror/games/g012/thumbnail?size=512',
    type: 'website',
  },

  '/arc3/upload': {
    title: 'Submit an ARC-AGI-3 task',
    description:
      'Contribute a task to the community set: one Python file on the official ARCEngine, '
      + 'reviewed before it goes live.',
    url: 'https://arc.markbarney.net/arc3/upload',
    type: 'website',
  },

  // ==================== RE-ARC Benchmark ====================
  '/re-arc': {
    title: 'RE-ARC Bench - Test Your ARC Solver',
    description: 'Generate fresh ARC puzzles and evaluate your solver with verifiable results',
    url: 'https://arc.markbarney.net/re-arc',
    type: 'website',
  },

  '/re-arc/leaderboard': {
    title: 'RE-ARC Bench Leaderboard',
    description: 'Generate fresh ARC puzzles and evaluate your solver with verifiable results',
    url: 'https://arc.markbarney.net/re-arc/leaderboard',
    type: 'website',
  },

  // ==================== ARC-AGI-1 / ARC-AGI-2 model results ====================
  // ARC Prize links straight to this page from arcprize.org, so it is the site's most
  // important search entry. Until 06-Oct-2026 it had no entry here and every crawler and
  // link preview saw the generic home-page title and description.
  // ARCHIVE (Boss, 06-Oct-2026): ARC Prize no longer publishes results to Hugging Face, so
  // the copy says archive and sends ARC-AGI-3 visitors to the live pages.
  '/analytics': {
    title: 'ARC-AGI Model Analytics (Archive): LLM Results on ARC-AGI-1 & 2 | ARC Explainer',
    description:
      "Archive of ARC Prize's published LLM evaluation results on ARC-AGI-1 and ARC-AGI-2: "
      + 'accuracy, cost and reliability per model and puzzle. For ARC-AGI-3, see our live leaderboard and game guides.',
    url: `${SITE}/analytics`,
    type: 'website',
    keywords:
      'ARC-AGI, ARC-AGI-2, ARC-AGI-1, ARC Prize, LLM benchmark, model accuracy, AI reasoning '
      + 'benchmark, abstract reasoning, model comparison, cost per task, ARC Prize results',
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${SITE}/analytics`,
          url: `${SITE}/analytics`,
          name: 'ARC-AGI Model Analytics (archive)',
          description:
            "Archive of ARC Prize's published LLM evaluation results on ARC-AGI-1 and ARC-AGI-2: "
            + 'accuracy, cost and reliability per model and per puzzle.',
          isPartOf: WEBSITE_REF,
          isBasedOn: 'https://huggingface.co/arcprize',
          about: [
            { '@type': 'Thing', name: 'ARC-AGI', sameAs: 'https://arcprize.org/arc-agi' },
            { '@type': 'Thing', name: 'Large language model evaluation' },
          ],
          inLanguage: 'en',
        },
        breadcrumb('Model Analytics', '/analytics'),
      ],
    },
    bodyHtml: `
      <main>
        <h1>ARC-AGI Model Analytics</h1>
        <p>An interactive archive of the ARC Prize team's evaluation results for large language
        models on ARC-AGI-1 and ARC-AGI-2, as they were published at
        <a href="https://huggingface.co/arcprize">huggingface.co/arcprize</a>. ARC Prize no
        longer publishes new results there.</p>
        <p>Looking for ARC-AGI-3? See the live <a href="/kaggle-leaderboard">ARC Prize 2026
        Kaggle leaderboard</a>, the <a href="/arc3/games">mechanics of every official ARC-AGI-3
        game</a>, or <a href="/">what we are doing on ARC-AGI-3</a>.</p>
        <p>Every model is run through the same harness: the same input grids and prompt for each
        puzzle, the output parsed and scored by the same rules, with cost and timing recorded.</p>
        <h2>What you can do here</h2>
        <ul>
          <li>Pick a model and a dataset (ARC-AGI-1, ARC-AGI-2 and others) and see which puzzles it solved, failed or skipped.</li>
          <li>Compare accuracy, cost per task and reliability across models.</li>
          <li>Open any puzzle to see the grids and every model's answer.</li>
        </ul>
        <p>Related: <a href="/leaderboards">model leaderboards</a>,
        <a href="/model-comparison">head-to-head model comparison</a>,
        <a href="/scoring">official scoring</a>, <a href="/browser">browse every puzzle</a>.</p>
      </main>`,
  },

  // ==================== ARC-AGI-3 Kaggle competition ====================
  '/kaggle-leaderboard': {
    title: 'ARC Prize 2026 ARC-AGI-3 Kaggle Leaderboard: Live Standings & History',
    description:
      'Every team on the ARC-AGI-3 Kaggle public leaderboard, saved every half hour: medal lines, '
      + "who is climbing, who is sinking, score history and the race to the close.",
    url: `${SITE}/kaggle-leaderboard`,
    type: 'website',
    keywords: 'ARC Prize 2026, ARC-AGI-3, Kaggle leaderboard, ARC Prize leaderboard, Kaggle competition standings',
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${SITE}/kaggle-leaderboard`,
          url: `${SITE}/kaggle-leaderboard`,
          name: 'ARC-AGI-3 Kaggle Leaderboard',
          isPartOf: WEBSITE_REF,
          isBasedOn: 'https://www.kaggle.com/competitions/arc-prize-2026-arc-agi-3/leaderboard',
          inLanguage: 'en',
        },
        breadcrumb('Kaggle Leaderboard', '/kaggle-leaderboard'),
      ],
    },
    bodyHtml: `
      <main>
        <h1>ARC-AGI-3 Kaggle leaderboard</h1>
        <p>Every team on the ARC Prize 2026 ARC-AGI-3 public Kaggle leaderboard, read every half
        hour: the gold, silver and bronze lines, who is rocketing up, who is sinking, score and
        rank history, and the full searchable table with links to each team on Kaggle.</p>
        <p>Source: <a href="https://www.kaggle.com/competitions/arc-prize-2026-arc-agi-3/leaderboard">Kaggle public leaderboard</a>.
        Medals are settled on the private board at the close.</p>
      </main>`,
  },

  '/kaggle-leaderboard/arc-2': {
    title: 'ARC Prize 2026 ARC-AGI-2 Kaggle Leaderboard: Live Standings & History',
    description:
      'Every team on the ARC-AGI-2 Kaggle public leaderboard, saved every half hour: medal lines, '
      + "who is climbing, who is sinking, score history and the race to the close.",
    url: `${SITE}/kaggle-leaderboard/arc-2`,
    type: 'website',
    keywords: 'ARC Prize 2026, ARC-AGI-2, Kaggle leaderboard, ARC Prize leaderboard, Kaggle competition standings',
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${SITE}/kaggle-leaderboard/arc-2`,
          url: `${SITE}/kaggle-leaderboard/arc-2`,
          name: 'ARC-AGI-2 Kaggle Leaderboard',
          isPartOf: WEBSITE_REF,
          isBasedOn: 'https://www.kaggle.com/competitions/arc-prize-2026-arc-agi-2/leaderboard',
          inLanguage: 'en',
        },
        breadcrumb('Kaggle Leaderboard', '/kaggle-leaderboard/arc-2'),
      ],
    },
    bodyHtml: `
      <main>
        <h1>ARC-AGI-2 Kaggle leaderboard</h1>
        <p>Every team on the ARC Prize 2026 ARC-AGI-2 public Kaggle leaderboard, read every half
        hour: the gold, silver and bronze lines, who is rocketing up, who is sinking, score and
        rank history, and the full searchable table with links to each team on Kaggle.</p>
        <p>Source: <a href="https://www.kaggle.com/competitions/arc-prize-2026-arc-agi-2/leaderboard">Kaggle public leaderboard</a>.
        Medals are settled on the private board at the close.</p>
      </main>`,
  },

  // ==================== Future Routes ====================
  // Dynamic per-task meta (/arc3/play/:gameId) is generated in the injector so each
  // task unfurls with its own opening frame.
  // '/puzzle/:id': dynamic meta tags based on puzzle data
  // '/debate/:id': dynamic meta tags based on debate data
  // '/worm-arena/live/:id': dynamic meta tags for live matches
};
/**
 * Meta for "/" by host. Both hosts render the same landing page now, so the copy is
 * shared; only the canonical url differs, which is the whole reason this is still keyed
 * by host rather than folded into ROUTE_META_TAGS.
 */
const ROOT_META: Omit<RouteMetaTags, 'url'> = {
  // Matches the page's H1, and makes no claim about AI for the same reason it does not.
  // This string is the Slack unfurl, the search result and the share card -- the stalest
  // copy on the site and the hardest to notice has gone stale. It carried "Very hard for
  // the best AI in the world" until 07-Sep-2026, three weeks after the body prose dropped
  // exactly that claim, and by then the chart further down the same page showed the
  // adapter harness at 100% on all 25 environments. The page was arguing with its title.
  //
  // IT IS NOT THE PLACE FOR THE ASK. It briefly read "Come and roast our tasks", which is
  // a fine throwaway line inside a paragraph and the wrong thing to be the page's whole
  // public identity -- this is what a search result, a shared link and every unfurl show
  // before anyone has read a word. The title says what the page IS. The ask lives on the
  // page, where someone has already arrived and the tone has somewhere to sit.
  title: "We're doing ARC-AGI-3.",
  // 05-Oct-2026: the landing page now leads with the Kaggle leaderboard, not the
  // practice games. Still no figures and no claim about AI.
  description:
    'Two people doing ARC-AGI-3 in spare evenings: our live place on the ARC Prize 2026 '
    + 'Kaggle leaderboard, who is climbing and sinking this week, and what we are building.',
  // See the note on /arc3/gallery above: ours, not the Foundation's.
  image: 'https://arc.markbarney.net/api/arc3-mirror/games/g012/thumbnail?size=512',
  type: 'website',
};

export const ROOT_META_BY_HOST: Record<string, RouteMetaTags> = {
  'arc3.markbarney.net': { ...ROOT_META, url: 'https://arc3.markbarney.net/' },
  'arc.markbarney.net': { ...ROOT_META, url: 'https://arc.markbarney.net/' },
};
