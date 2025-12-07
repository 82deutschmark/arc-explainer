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
 * Screenshot of a specific game level
 */
export interface LevelScreenshot {
  /** Level number (1-based) */
  level: number;
  /** Image URL relative to public folder (e.g., '/ft09-lvl8.png') */
  imageUrl: string;
  /** Optional caption or description */
  caption?: string;
  /** Optional notes about this specific level */
  notes?: string;
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

  /** Level screenshots organized by level number */
  levelScreenshots?: LevelScreenshot[];

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
    hints: [],
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
    levelScreenshots: [
      {
        level: 4,
        imageUrl: '/ls20-lvl4.png',
      },
      {
        level: 5,
        imageUrl: '/ls20-lvl5.png',
      },
    ],
    tags: ['puzzle', 'navigation', 'keys-and-doors', 'exploration', 'multi-level'],
    thumbnailUrl: '/ls20.png',
    isFullyDocumented: true,
    notes: 'This was one of the most studied games during the preview period.',
  },

  as66: {
    gameId: 'as66',
    officialTitle: 'as66',
    informalName: 'Always Sliding',
    description: 'A dynamic puzzle game featuring continuously moving elements. Navigate and solve challenges in an environment where objects are always in motion.',
    category: 'preview',
    difficulty: 'unknown',
    actionMappings: [],
    hints: [],
    resources: [],
    levelScreenshots: [
      {
        level: 3,
        imageUrl: '/as66-lvl3.png',
      },
    ],
    tags: ['sliding', 'motion', 'dynamic'],
    thumbnailUrl: '/as66.png',
    isFullyDocumented: false,
    notes: 'Part of the original preview set. Documentation in progress.',
  },

  ft09: {
    gameId: 'ft09',
    officialTitle: 'ft09',
    informalName: 'Functional Tiles',
    description: 'A puzzle game featuring tiles with specific functions and behaviors. Interact with different tile types to solve spatial challenges and manage colored resources.',
    mechanicsExplanation: `
The "Functional Tiles" game is a spatial puzzle where you interact with different tile types to achieve level objectives.

**Objective:** Navigate and manipulate various functional tiles to complete increasingly complex puzzles across multiple levels.

**Key Mechanics:**
- Multiple tile types with distinct visual patterns and behaviors
- Resource management indicated by colored bars (yellow, green, light blue)
- Gray "container" tiles with colored elements (yellow/white, green/white patterns)
- Yellow solid tiles (possibly moveable or interactive elements)
- Pink/magenta tiles with yellow cross/checkered patterns (special function tiles)
- Vertical progress/inventory indicator on the right side showing collected or available resources

**Visual Elements:**
- Dark gray/black: Background grid
- Gray tiles with patterns: Interactive containers or puzzle elements
- Yellow tiles: Primary interactive elements
- Pink/magenta checkered tiles: Special function tiles
- Light blue tiles: Secondary resource or goal elements
- Right-side colored bar: Resource inventory or progress tracker (yellow, green, blue sections)

**Level Progression:**
- At least 9 levels confirmed (screenshots available for levels 8 and 9)
- Complexity increases with more tile types and spatial arrangements
- Later levels (8, 9) show intricate tile placement patterns requiring strategic interaction
    `,
    category: 'preview',
    difficulty: 'medium',
    levelCount: 9,
    actionMappings: [
      { action: 'ACTION1', commonName: 'Up', description: 'Move or interact upward' },
      { action: 'ACTION2', commonName: 'Down', description: 'Move or interact downward' },
      { action: 'ACTION3', commonName: 'Left', description: 'Move or interact left' },
      { action: 'ACTION4', commonName: 'Right', description: 'Move or interact right' },
      { action: 'ACTION5', commonName: 'Action/Interact', description: 'Activate tile function or interact with element' },
    ],
    hints: [],
    resources: [],
    levelScreenshots: [
      {
        level: 8,
        imageUrl: '/ft09-lvl8.png',
      },
      {
        level: 9,
        imageUrl: '/ft09-lvl9.png',
      },
    ],
    tags: ['tiles', 'functions', 'spatial', 'resource-management', 'multi-level'],
    thumbnailUrl: '/ft09.png',
    isFullyDocumented: false,
    notes: 'Part of the original preview set. Level 8 and 9 screenshots reveal complex tile-based puzzle mechanics with resource management elements.',
  },

  lp85: {
    gameId: 'lp85',
    officialTitle: 'lp85',
    informalName: 'Loop & Pull',
    description: 'A puzzle game involving looping patterns and pulling mechanics. Master the interplay between circular movements and directional forces.',
    category: 'evaluation',
    difficulty: 'unknown',
    actionMappings: [],
    hints: [],
    resources: [],
    tags: ['evaluation-set', 'loops', 'mechanics', 'patterns'],
    thumbnailUrl: '/lp85.png',
    isFullyDocumented: false,
    notes: 'Part of the evaluation set - held back from public preview.',
  },

  sp80: {
    gameId: 'sp80',
    officialTitle: 'sp80',
    informalName: 'Streaming Purple',
    description: 'A visually distinctive game featuring flowing purple elements. Navigate or manipulate streaming patterns to achieve objectives.',
    category: 'evaluation',
    difficulty: 'unknown',
    actionMappings: [],
    hints: [],
    resources: [],
    tags: ['evaluation-set', 'streaming', 'visual', 'flow'],
    thumbnailUrl: '/sp80.png',
    isFullyDocumented: false,
    notes: 'Part of the evaluation set - held back from public preview.',
  },

  vc33: {
    gameId: 'vc33',
    officialTitle: 'vc33',
    informalName: 'Volume Control',
    description: 'A puzzle game centered on adjusting volumes, sizes, or quantities. Manipulate spatial or numerical properties to solve challenges.',
    category: 'evaluation',
    difficulty: 'unknown',
    actionMappings: [],
    hints: [],
    resources: [],
    tags: ['evaluation-set', 'volume', 'adjustment', 'spatial'],
    thumbnailUrl: '/vc33.png',
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
