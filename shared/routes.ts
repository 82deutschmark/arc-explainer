/**
 * Author: GPT-6 Codex
 * Date: 2026-10-08
 * PURPOSE: Centralized public route descriptions and indexing policy for server HTML,
 *          browser navigation, discovery links and the generated sitemap. Analytics archive
 *          copy reports dated source metadata and mixed-run provenance without assuming a publication stop.
 *          2026-10-06: entries can now carry keywords, structured data (JSON-LD) and a
 *          crawlable HTML summary that is served inside #root until the app renders, so a
 *          crawler that does not run JavaScript still sees a real page. Added /analytics
 *          (ARC Prize links to it) and /kaggle-leaderboard; root copy follows the
 *          landing page's 05-Oct pivot to the leaderboard.
 *          08-Oct-2026 (Claude Opus 5.5): image size and Open Graph article fields; the two
 *          ARC Daily index routes use the newspaper's own share card. The front-page
 *          description now leads with ARC-AGI-3 and its linked results.
 * SRP/DRY check: Pass - Single source of truth for route meta tags
 */

import { SLIPPERY_SEVEN } from './arc3Games/slipperySeven';
import { NEWS_CARD_HEIGHT, NEWS_CARD_WIDTH, NEWS_SECTION_CARD_ALT, NEWS_SECTION_CARD_PATH } from './news';

export interface RouteMetaTags {
  title: string;
  /** Unlisted tools and transient sessions must not enter search indexes. */
  noindex?: boolean;
  imageAlt?: string;
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
  /** Pixel size of `image`, when known; lets unfurlers lay the card out before fetching it. */
  imageWidth?: number;
  imageHeight?: number;
  /** Open Graph article fields (`og:type` article only). */
  publishedTime?: string;
  section?: string;
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

/** The ARC Daily's own masthead card instead of the site-wide preview image. */
const NEWS_CARD = { image: `${SITE}${NEWS_SECTION_CARD_PATH}`, imageAlt: NEWS_SECTION_CARD_ALT, imageWidth: NEWS_CARD_WIDTH, imageHeight: NEWS_CARD_HEIGHT };

/**
 * Route meta tags for link unfurling (Discord, Twitter, Slack, etc.)
 * Organized by feature area - add new routes near related routes
 */
export const ROUTE_META_TAGS: Record<string, RouteMetaTags> = {
  '/news': { title: 'The ARC Daily — ARC-AGI-3 Kaggle contest daily', description: 'ARC-AGI-3 Kaggle contest reporting, leaderboard graphics, human records and sourced competitor profiles. ARC-AGI-2 editions are covered separately.', url: `${SITE}/news`, ...NEWS_CARD },
  '/news/competitors': { title: 'Competitor notebook | The ARC Daily', description: 'The ARC Daily’s growing, sourced notebook of ARC-AGI competitors, their public team identities and competition coverage.', url: `${SITE}/news/competitors`, ...NEWS_CARD },
  '/home': {
    title: 'ARC Explainer Resource Hub — games, guides and results',
    description: 'Find Human ARC, Space Force Mission Control, ARC-AGI-3 game guides, human and AI results, and archived benchmark analyses.',
    url: `${SITE}/home`,
    type: 'website',
    bodyHtml: '<h1>ARC Explainer Resource Hub</h1><p>Independent community games, guides and results by Mark Barney.</p><ul><li><a href="/human-arc/">Human ARC puzzles and assessments</a></li><li><a href="https://sfmc.markbarney.net/">Space Force Mission Control</a></li><li><a href="/arc3/games">ARC-AGI-3 game guides</a></li><li><a href="/human-records.html">Human and AI results</a></li><li><a href="/analytics">Hugging Face results archive</a></li></ul>',
  },
  // ==================== ARC-AGI-3 ====================
  // Both public hosts share the same landing page and preferred canonical origin.
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

  '/arc3/slippery-seven': {
    title: 'The Slippery Seven — ARC-AGI-3 game guides',
    description: 'Seven games that resisted all four passes of the September 16, 2026 Qwen 27B run. Explore screenshots and the guide for each game.',
    url: `${SITE}/arc3/slippery-seven`,
    image: `${SITE}/api/arc3/og-image/sk48`,
    type: 'website',
    bodyHtml: '<h1>The Slippery Seven</h1><p>Seven games. Four passes each. No levels cleared in the September 16, 2026 Qwen 27B experiment. This name records that research run; other models have cleared levels on several of these games.</p>' + '<ul>' + SLIPPERY_SEVEN.map(({ gameId }) => `<li><a href="/arc3/games/${gameId}">${gameId}</a></li>`).join('') + '</ul>',
  },

  '/arc3/gallery': {
    title: 'ARC-AGI-3 Tasks — play one, no instructions',
    description:
      'Play community-made ARC-AGI-3 reasoning tasks without instructions. Explore the board, try actions and work out each task’s rules.',
    url: 'https://arc.markbarney.net/arc3/gallery',
    // OUR game, not an official one. This was ls20-9607627b -- an ARC Prize Foundation
    // task -- so every share of this site led with somebody else's work as the picture.
    // g012 is from the reviewed set and has the busiest opening frame of the fifty
    // (10 colours) which is what survives being shrunk to a share-card thumbnail.
    image: 'https://arc.markbarney.net/api/arc3-mirror/games/g012/thumbnail?size=512',
    type: 'website',
  },

  // ==================== RE-ARC Benchmark ====================
  '/re-arc': {
    title: 'RE-ARC Bench - Test Your ARC Solver',
    description: 'Generate fresh ARC puzzles and evaluate your solver with verifiable results',
    url: 'https://arc.markbarney.net/re-arc',
    type: 'website',
  },

  // ==================== ARC-AGI-1 / ARC-AGI-2 model results ====================
  // ARC Prize links straight to this page from arcprize.org, so it is the site's most
  // important search entry. Until 06-Oct-2026 it had no entry here and every crawler and
  // link preview saw the generic home-page title and description.
  // ARCHIVE: source APIs checked 07-Oct-2026 list 04-Jun-2026 as the last update.
  // Keep that observation dated; it does not establish a permanent publication stop.
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
        <a href="https://huggingface.co/arcprize">huggingface.co/arcprize</a>.</p>
        <p>When checked on October 7, 2026, the
        <a href="https://huggingface.co/api/datasets/arcprize/arc_agi_v1_public_eval">ARC-AGI-1</a>
        and <a href="https://huggingface.co/api/datasets/arcprize/arc_agi_v2_public_eval">ARC-AGI-2</a>
        Hugging Face result datasets both listed June 4, 2026 as their last update.
        This page explores imported records.</p>
        <p>Looking for ARC-AGI-3? See the live <a href="/kaggle-leaderboard">ARC Prize 2026
        Kaggle leaderboard</a>, the <a href="/arc3/games">mechanics of every official ARC-AGI-3
        game</a>, or <a href="/">what we are doing on ARC-AGI-3</a>.</p>
        <p>This archive combines official ARC Prize results imported from Hugging Face with community
        and local runs. Prompts, reasoning settings, available attempts and dataset coverage can differ;
        compare matching configurations and coverage. For ARC Prize’s evaluation and scoring code, see its
        <a href="https://github.com/arcprize/arc-agi-benchmarking">open-source benchmarking harness</a>.</p>
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
 * shared, with arc.markbarney.net as the preferred canonical origin for both.
 */
const ROOT_META: Omit<RouteMetaTags, 'url'> = {
  title: 'ARC Explainer — ARC-AGI games, guides and Kaggle standings',
  description: 'Follow the ARC Prize Kaggle leaderboards, explore ARC-AGI-3 game guides and research, and try interactive reasoning tasks.',
  type: 'website',
  bodyHtml: `<main><h1>We're doing ARC-AGI-3.</h1><p>Two people working on ARC-AGI-3 in spare evenings: following the Kaggle competition, building an agent and testing interactive reasoning tasks.</p><p>Explore the <a href="/kaggle-leaderboard">ARC-AGI-3 leaderboard</a> and <a href="/kaggle-leaderboard/arc-2">ARC-AGI-2 leaderboard</a>, with team standings, score history and changes over time.</p><p><a href="/arc3/gallery">Try a community task</a>, read the <a href="/arc3/games">official game guides (spoilers)</a>, explore <a href="/arc3/hypotheses">research on model reasoning</a> or visit the <a href="/home">resource hub</a>.</p></main>`,
};

// Both hosts now render the same site. Share one preferred origin, including at root.
export const ROOT_META_BY_HOST: Record<string, RouteMetaTags> = {
  'arc3.markbarney.net': { ...ROOT_META, url: `${SITE}/` },
  'arc.markbarney.net': { ...ROOT_META, url: `${SITE}/` },
};
ROUTE_META_TAGS['/'] = ROOT_META_BY_HOST['arc.markbarney.net'];

/** Descriptive metadata for every remaining static SPA route. Interactive tools keep
 * their own URLs but are deliberately absent from the search sitemap. */
const ADDITIONAL_PAGES: [string, string, string, boolean?][] = [
  ['/browser', 'ARC puzzle browser', 'Browse ARC-AGI grid puzzles by dataset and grid size, then open a puzzle to explore its examples and model answers.'],
  ['/trading-cards', 'ARC puzzle trading cards', 'Explore ARC puzzles as visual trading cards and open each puzzle for examples and analysis.'],
  ['/hall-of-fame', 'ARC community hall of fame', 'Meet contributors to the ARC community and explore their puzzle-solving work.'],
  ['/hall-of-fame/johan-land', 'Johan Land — ARC community tribute', 'Explore Johan Land’s contribution to ARC puzzle solving and the results collected on ARC Explainer.'],
  ['/discussion', 'ARC puzzle discussions', 'Explore community discussions of ARC puzzles, model explanations and reasoning strategies.'],
  ['/leaderboards', 'ARC model leaderboards', 'Compare recorded ARC model results by accuracy, reliability and cost. These are model evaluations, separate from the Kaggle competition standings.'],
  ['/models', 'ARC model results browser', 'Browse language models evaluated on ARC puzzles and explore their recorded performance.'],
  ['/elo/leaderboard', 'ARC explanation Elo leaderboard', 'Explore model rankings from pairwise comparisons of ARC puzzle explanations.'],
  ['/feedback', 'ARC explanation feedback', 'Browse feedback on model-generated ARC puzzle explanations and explore the associated puzzles.'],
  ['/model-comparison', 'Compare ARC model results', 'Compare recorded model performance across ARC puzzles and datasets.'],
  ['/scoring', 'How ARC model accuracy is scored', 'Understand how ARC Explainer combines recorded Hugging Face evaluation results and scores model answers.'],
  ['/about', 'About ARC Explainer', 'Learn about ARC Explainer, its puzzle-analysis tools, community game guides and benchmark resources.'],
  ['/cc', 'Claude Code guide for ARC', 'A guide to using Claude Code in ARC puzzle-analysis workflows.'],
  ['/llm-reasoning', 'Language-model reasoning on ARC puzzles', 'Explore how language models approach ARC puzzles and the tools used to examine their reasoning.'],
  ['/llm-reasoning/advanced', 'Advanced ARC reasoning tools', 'Explore advanced workflows for investigating language-model reasoning on ARC puzzles.'],
  ['/arc3', 'ARC-AGI-3 explained', 'An introduction to the interactive ARC-AGI-3 benchmark, its games and the challenge of learning unfamiliar rules through actions.'],
  ['/arc3/hypotheses', 'What a model guesses from one game frame', 'Research on local-model hypotheses about unseen ARC-AGI-3 frames and the effects of LM Studio thinking controls.'],
  ['/re-arc/submissions', 'RE-ARC benchmark submissions', 'Explore submitted RE-ARC benchmark results and their verifiable evaluation records.'],
  ['/snakebench', 'SnakeBench on ARC Explainer', 'Explore the upstream SnakeBench project, where language models compete in Snake.'],
  ['/worm-arena', 'Worm Arena — language models play Snake', 'Watch and compare language models playing Snake in Worm Arena, ARC Explainer’s local SnakeBench-based arena.'],
  ['/worm-arena/matches', 'Worm Arena match archive', 'Browse recorded Worm Arena matches and inspect how language models played Snake.'],
  ['/worm-arena/models', 'Worm Arena models', 'Explore the language models represented in Worm Arena and their recorded match results.'],
  ['/worm-arena/stats', 'Worm Arena statistics', 'Explore recorded match statistics and model performance in Worm Arena.'],
  ['/worm-arena/skill-analysis', 'Worm Arena skill analysis', 'Examine model skill estimates and supporting match results from Worm Arena.'],
  ['/worm-arena/distributions', 'Worm Arena rating distributions', 'Compare model rating distributions and uncertainty in Worm Arena.'],
  ['/worm-arena/rules', 'Worm Arena rules', 'Read the rules and mechanics for language-model Snake matches in Worm Arena.'],
  ['/play', 'Play an ARC-AGI-3 task', 'Start a community reasoning task without instructions and discover its rules by playing.', true],
  ['/arc3/playground', 'ARC-AGI-3 agent playground', 'Run an interactive ARC-AGI-3 agent experiment.', true],
  ['/arc3/archive/playground', 'Archived ARC-AGI-3 playground', 'The earlier ARC-AGI-3 experiment interface.', true],
  ['/arc3/mechanics', 'Community task mechanics', 'Unlisted reference for community task mechanics.', true],
  ['/kaggle-readiness', 'Kaggle readiness validation', 'Validate an ARC submission workflow.', true],
  ['/puzzles/database', 'ARC puzzle database tools', 'Inspect stored ARC puzzle records.', true],
  ['/model-config', 'Model configuration', 'Manage ARC Explainer model settings.', true],
  ['/admin', 'Administration', 'ARC Explainer administrative tools.', true],
  ['/admin/models', 'Model administration', 'Manage ARC Explainer model configuration.', true],
  ['/admin/ingest-hf', 'Hugging Face ingestion', 'Import model evaluation records.', true],
  ['/admin/openrouter', 'OpenRouter administration', 'Manage model catalog integration.', true],
  ['/elo', 'Compare ARC explanations', 'Compare two model explanations of an ARC puzzle.', true],
  ['/test-solution', 'Test an ARC solution', 'Check a proposed solution to an ARC puzzle.', true],
  ['/debate', 'ARC model debate', 'Start a model debate about an ARC puzzle.', true],
  ['/council', 'ARC model council', 'Run a multi-model discussion of an ARC puzzle.', true],
  ['/dataset-viewer', 'RE-ARC dataset viewer', 'Inspect a generated RE-ARC dataset.', true],
  ['/poetiq', 'Poetiq ARC solver', 'Explore the Poetiq ARC solver workflow.', true],
  ['/puzzle/beetree', 'Beetree ARC solver', 'Start a Beetree ARC solver session.', true],
  ['/worm-arena/live', 'Live Worm Arena match', 'Watch a live language-model Snake match.', true],
];
for (const [route, name, description, noindex] of ADDITIONAL_PAGES) {
  ROUTE_META_TAGS[route] = { title: `${name} | ARC Explainer`, description, url: `${SITE}${route}`, noindex };
}
