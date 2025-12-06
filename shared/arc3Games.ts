/*
 * Author: Claude (Windsurf Cascade)
 * Date: 2025-12-05
 * PURPOSE: Centralized game metadata and spoiler content for ARC-AGI-3 games.
 *          This is the "ultimate spoilers" database - everything we've learned about each game.
 *          Used by the Arc3GamesBrowser and Arc3GameSpoiler pages.
 * SRP/DRY check: Pass - Single source of truth for all game metadata and community knowledge.
 */

/**
 * Difficulty ratings based on community experience I don't think this will mean anything as highly subjective. It would probably be more useful to have something like what type of game it is.
 */
export type DifficultyRating = 'easy' | 'medium' | 'hard' | 'very-hard' | 'unknown';

/**
 * Game category - whether it was in original preview or evaluation set
 */
export type GameCategory = 'preview' | 'evaluation';

/**
 * Action mapping for a game - what each ACTION does This will be difficult because we don't know, and it may change from game to game.
 */
export interface ActionMapping {
  action: 'ACTION1' | 'ACTION2' | 'ACTION3' | 'ACTION4' | 'ACTION5' | 'ACTION6' | 'ACTION7';
  description: string;
  /** Common mapping like "Up", "Down", "Left", "Right", "Click", etc. */
  commonName?: string;
  /** Additional notes about how this action behaves */
  notes?: string;
}

/**
 * A single hint or strategy tip
 */
export interface GameHint {
  id: string;
  title: string;
  content: string;
  /** Spoiler level: 1 = mild hint, 2 = moderate spoiler, 3 = full solution */
  spoilerLevel: 1 | 2 | 3;
  /** Who contributed this hint */
  contributor?: string;
  /** Date added */
  dateAdded?: string;
}

/**
 * External resource related to a game
 */
export interface GameResource {
  title: string;
  url: string;
  type: 'article' | 'video' | 'github' | 'discussion' | 'paper';
  description?: string;
}

/**
 * Complete metadata for an ARC-AGI-3 game
 */
export interface Arc3GameMetadata {
  /** Official game ID (e.g., "ls20") */
  gameId: string;
  
  /** Official title from the ARC3 API */
  officialTitle: string;
  
  /** Informal community name (e.g., "locksmith" for ls20) */
  informalName?: string;
  
  /** Brief description of the game objective (may contain spoilers) */
  description: string;
  
  /** Detailed explanation of the game mechanics (full spoiler) */
  mechanicsExplanation?: string;
  
  /** Category: preview (public from start) or evaluation (held back) */
  category: GameCategory;
  
  /** Difficulty rating based on community experience */
  difficulty: DifficultyRating;
  
  /** Win score required to complete the game */
  winScore?: number;
  
  /** Maximum actions allowed */
  maxActions?: number;
  
  /** Number of levels in the game (if applicable) */
  levelCount?: number;
  
  /** Mapping of what each ACTION does in this game */
  actionMappings: ActionMapping[];
  
  /** Hints and strategies (spoilers) */
  hints: GameHint[];
  
  /** External resources (articles, videos, etc.) */
  resources: GameResource[];
  
  /** Tags for categorization */
  tags: string[];
  
  /** Screenshot or thumbnail URL (relative to public folder) */
  thumbnailUrl?: string;
  
  /** Whether this game has been fully documented */
  isFullyDocumented: boolean;
  
  /** Additional notes */
  notes?: string;
}

/**
 * Complete database of ARC-AGI-3 game metadata and spoilers.
 * 
 * The 6 revealed games from the preview:
 * - Preview set (public from start): ls20, as66, ft09
 * - Evaluation set (held back): lp85, sp80, vc33
 */
export const ARC3_GAMES: Record<string, Arc3GameMetadata> = {
  ls20: {
    gameId: 'ls20',
    officialTitle: 'ls20',
    informalName: 'Locksmith',
    description: 'Navigate a character through a puzzle environment, collecting keys to unlock doors and reach the goal.',
    mechanicsExplanation: `
The "Locksmith" game is a puzzle-exploration game where you control a white character on a 64x64 grid.

**Objective:** Collect keys of matching colors to unlock corresponding doors, navigating through the environment to reach the goal and maximize your score.

**Key Mechanics:**
- The white character is controlled using directional actions
- Colored keys (blue, orange, etc.) must be collected to unlock matching colored doors
- Score increases as you progress through levels
- Multiple levels exist, each more complex than the last

**Visual Elements:**
- Dark gray: Walls/obstacles
- White squares: Your character
- Colored rectangles: Keys and doors
- Pink/magenta bar at top: Progress indicator
- Red indicators: Goal markers or win conditions
    `,
    category: 'preview',
    difficulty: 'medium',
    winScore: 8,
    maxActions: 2000,
    levelCount: 8,
    actionMappings: [
      { action: 'ACTION1', commonName: 'Up', description: 'Move character up one cell' },
      { action: 'ACTION2', commonName: 'Down', description: 'Move character down one cell' },
      { action: 'ACTION3', commonName: 'Left', description: 'Move character left one cell' },
      { action: 'ACTION4', commonName: 'Right', description: 'Move character right one cell' },
      { action: 'ACTION5', commonName: 'Space/Action', description: 'Interact with environment (pick up key, unlock door)' },
      { action: 'ACTION6', commonName: 'Click', description: 'Click at specific coordinates (x, y)', notes: 'Requires coordinate parameters' },
    ],
    hints: [
      {
        id: 'ls20-hint-1',
        title: 'The Name Gives It Away',
        content: 'The informal name "Locksmith" hints at the core mechanic - you need to find and use keys to unlock doors.',
        spoilerLevel: 1,
        contributor: 'Community',
        dateAdded: '2025-11-01',
      },
      {
        id: 'ls20-hint-2',
        title: 'Color Matching',
        content: 'Keys and doors are color-coded. You need the blue key for blue doors, orange key for orange doors, etc.',
        spoilerLevel: 2,
        contributor: 'Community',
        dateAdded: '2025-11-01',
      },
      {
        id: 'ls20-hint-3',
        title: 'Exploration Strategy',
        content: 'Start by exploring the entire visible area before committing to a path. Keys may be hidden in corners or behind obstacles you need to navigate around.',
        spoilerLevel: 2,
        contributor: 'StochasticGoose',
        dateAdded: '2025-11-15',
      },
      {
        id: 'ls20-hint-4',
        title: 'Level Progression',
        content: 'The game has 8 levels. Each level is more complex than the last. Win score of 8 means you need to complete all 8 levels.',
        spoilerLevel: 3,
        contributor: 'Community',
        dateAdded: '2025-11-20',
      },
    ],
    resources: [
      {
        title: 'ARC-AGI-3 Preview: 30-Day Learnings',
        url: 'https://arcprize.org/blog/arc-agi-3-preview-30-day-learnings',
        type: 'article',
        description: 'Official blog post with insights from the preview competition',
      },
      {
        title: 'StochasticGoose 1st Place Solution',
        url: 'https://medium.com/@dries.epos/1st-place-in-the-arc-agi-3-agent-preview-competition-49263f6287db',
        type: 'article',
        description: 'Dries Smit\'s writeup on winning the preview competition',
      },
    ],
    tags: ['puzzle', 'navigation', 'keys-and-doors', 'exploration', 'multi-level'],
    thumbnailUrl: '/images/arc3/ls20-thumbnail.png',
    isFullyDocumented: true,
    notes: 'This was one of the most studied games during the preview period.',
  },

  as66: {
    gameId: 'as66',
    officialTitle: 'as66',
    informalName: undefined, // Community hasn't named this one yet
    description: 'An ARC-AGI-3 preview game. Mechanics and objective to be documented.',
    category: 'preview',
    difficulty: 'unknown',
    actionMappings: [],
    hints: [],
    resources: [],
    tags: [],
    isFullyDocumented: false,
    notes: 'Part of the original preview set. Documentation in progress.',
  },

  ft09: {
    gameId: 'ft09',
    officialTitle: 'ft09',
    informalName: undefined,
    description: 'An ARC-AGI-3 preview game. Mechanics and objective to be documented.',
    category: 'preview',
    difficulty: 'unknown',
    actionMappings: [],
    hints: [],
    resources: [],
    tags: [],
    isFullyDocumented: false,
    notes: 'Part of the original preview set. Documentation in progress.',
  },

  lp85: {
    gameId: 'lp85',
    officialTitle: 'lp85',
    informalName: undefined,
    description: 'An ARC-AGI-3 evaluation game. This was held back during the preview for evaluation purposes.',
    category: 'evaluation',
    difficulty: 'unknown',
    actionMappings: [],
    hints: [],
    resources: [],
    tags: ['evaluation-set'],
    isFullyDocumented: false,
    notes: 'Part of the evaluation set - held back from public preview.',
  },

  sp80: {
    gameId: 'sp80',
    officialTitle: 'sp80',
    informalName: undefined,
    description: 'An ARC-AGI-3 evaluation game. This was held back during the preview for evaluation purposes.',
    category: 'evaluation',
    difficulty: 'unknown',
    actionMappings: [],
    hints: [],
    resources: [],
    tags: ['evaluation-set'],
    isFullyDocumented: false,
    notes: 'Part of the evaluation set - held back from public preview.',
  },

  vc33: {
    gameId: 'vc33',
    officialTitle: 'vc33',
    informalName: undefined,
    description: 'An ARC-AGI-3 evaluation game. This was held back during the preview for evaluation purposes.',
    category: 'evaluation',
    difficulty: 'unknown',
    actionMappings: [],
    hints: [],
    resources: [],
    tags: ['evaluation-set'],
    isFullyDocumented: false,
    notes: 'Part of the evaluation set - held back from public preview.',
  },
};

/**
 * Get all games as an array, sorted by category and then by gameId
 */
export function getAllGames(): Arc3GameMetadata[] {
  return Object.values(ARC3_GAMES).sort((a, b) => {
    // Preview games first
    if (a.category !== b.category) {
      return a.category === 'preview' ? -1 : 1;
    }
    return a.gameId.localeCompare(b.gameId);
  });
}

/**
 * Get games by category
 */
export function getGamesByCategory(category: GameCategory): Arc3GameMetadata[] {
  return getAllGames().filter(game => game.category === category);
}

/**
 * Get a specific game by ID
 */
export function getGameById(gameId: string): Arc3GameMetadata | undefined {
  return ARC3_GAMES[gameId];
}

/**
 * Check if a game exists in our database
 */
export function hasGameMetadata(gameId: string): boolean {
  return gameId in ARC3_GAMES;
}
