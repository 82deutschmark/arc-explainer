/**
 * ARC-AGI Emoji Palettes and Helpers
 * Provides multiple ARC-aligned emoji palettes (each length-10, mapping 0-9)
 * and utility functions to translate ARC colour digits to emojis.
 * Author: Cascade (GPT-5 High Reasoning)
 *
 * How it's used in the project:
 * - UI components like `components/puzzle/GridCell.tsx` call `getSpaceEmoji(value, set)`
 *   to render an emoji for a grid cell when emoji mode is enabled.
 * - `DEFAULT_EMOJI_SET` preserves previous behavior via the legacy mapping.
 */

// ARC-aligned space emoji palettes (each list is exactly length-10: indices 0..9)
// 0 is the explicit "empty/black" cell to avoid null handling.
export const SPACE_EMOJIS = {
  // Legacy default (backward compatibility with previous single-map implementation)
  legacy_default: ['⬛', '✅', '👽', '👤', '🪐', '🌍', '🛸', '☄️', '♥️', '⚠️'],

  // Celestial Bodies - Set 1 (Earth and celestial bodies)
  celestial_set1: ['⬛', '🌍', '🌎', '🌏', '⭐', '🌟', '✨', '💫', '🌠', '🪐'],

  // Celestial Bodies - Set 2 (Moon phases)
  celestial_set2: ['⬛', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '☀️'],

  // Technology & Equipment - Set 1 (power and fuel)
  tech_set1: ['⬛', '⚡', '🔋', '🔌', '⛽', '☢️', '⚛️', '🔗', '⚙️', '🔧'],

  // Technology & Equipment - Set 2 (communication)
  tech_set2: ['⬛', '📡', '🛰️', '📱', '⌨️', '📶', '📋', '💻', '🎚️', '🎧'],

  // Navigation & Alerts (directional and compass)
  nav_alerts: ['⬛', '⬆️', '⬇️', '⬅️', '➡️', '↗️', '↖️', '↘️', '↙️', '🧭'],

  // Status & Alerts (warning and safety systems)
  status_alerts: ['⬛', '✅', '❌', '⚠️', '🚨', '🦺', '🔥', '❄️', '📍', '🎯'],

  // Weather & Climate (atmospheric conditions)
  weather_climate: ['⬛', '🌞', '🌝', '🌛', '🌜', '🌧️', '⛈️', '🌩️', '🌨️', '❄️'],

  // Status - Human Crew and Coworkers
  status_emojis: ['⬛', '😂', '😶', '😐', '🙄', '😴', '😵', '🤗', '🤔', '😣'],

  // Status - AI and Computer Systems
  ai_emojis: ['⬛', '🤖', '💡', '🧠', '🔗', '⚙️', '🔧', '🔄', '⚡', '🚫'],

  // Vague Symbols - For the hardest tasks
  vague_symbols: ['⬛', '♊', '💕', '💢', '🆎', '🆒', '🈚', '🛃', '💠', '☣'],

  // Alien Language - For the hardest tasks (filled to length-10)
  alien_language: ['⬛', '👽', '👤', '🪐', '🌍', '🛸', '☄️', '♥️', '⚠️', '🌎'],

  // Birds - For the hardest tasks (filled to length-10)
  birds: ['🐦', '🦃', '🦆', '🦉', '🐤', '🦅', '🦜', '🦢', '🐓', '🦩'],
} as const;

// Emoji set metadata for UI display
export const EMOJI_SET_INFO = {
  legacy_default: {
    name: 'Legacy Default',
    description: 'Original ARC-Explainer emoji mapping',
    theme: 'Compatibility'
  },
  celestial_set1: {
    name: 'Planetary Bodies',
    description: 'Earth variants and lunar phases',
    theme: 'Celestial Navigation'
  },
  celestial_set2: {
    name: 'Stellar Objects',
    description: 'Stars, cosmic phenomena, and distant planets',
    theme: 'Deep Space'
  },
  tech_set1: {
    name: 'Power & Fuel Systems',
    description: 'Power & Fuel systems',
    theme: 'Power & Fuel'
  },
  tech_set2: {
    name: 'Communication Systems',
    description: 'Communication arrays and signal relays',
    theme: 'Communication'
  },
  nav_alerts: {
    name: 'Navigation Vectors',
    description: 'Directional indicators and compass systems',
    theme: 'Navigation'
  },
  status_alerts: {
    name: 'Alert Systems',
    description: 'Warnings, confirmations, and safety indicators',
    theme: 'Mission Safety'
  },
  weather_climate: {
    name: 'Atmospheric Data',
    description: 'Weather patterns and climate conditions',
    theme: 'Environmental'
  },
  status_emojis: {
    name: 'Human Crew and Coworkers',
    description: 'Human crew and coworkers',
    theme: 'Mission Safety'
  },
  ai_emojis: {
    name: 'AI and Computer Systems',
    description: 'AI and computer systems',
    theme: 'Mission Safety'
  },
  vague_symbols: {
    name: 'Vague Symbols',
    description: 'Vague symbols',
    theme: 'Officer Candidate'
  },
  alien_language: {
    name: 'Alien Language',
    description: 'Alien language',
    theme: 'Officer Candidate'
  },
  birds: {
    name: 'Birds',
    description: 'Birds',
    theme: 'Officer Candidate'
  }
} as const;

export type EmojiSet = keyof typeof SPACE_EMOJIS;
export type SpaceEmoji = typeof SPACE_EMOJIS[EmojiSet][number];

// Default set preserves prior behavior
export const DEFAULT_EMOJI_SET: EmojiSet = 'legacy_default';

/**
 * Returns the emoji for a given ARC colour digit (0-9) from the specified set.
 */
export function getSpaceEmoji(value: number, set: EmojiSet = DEFAULT_EMOJI_SET): string {
  const arr = SPACE_EMOJIS[set];
  return arr?.[value] ?? '❓';
}

/**
 * Optional descriptions for the legacy set (used in some tooltips)
 */
export function getEmojiDescription(value: number): string {
  const descriptions = {
    0: 'No/Nothing/Negative',
    1: 'Yes/Positive/Agreement',
    2: 'Alien/Them',
    3: 'Human/Us',
    4: 'Their Planet/Home',
    5: 'Our Planet/Earth',
    6: 'Their Ships/Travel',
    7: 'Danger/Bad/Problem',
    8: 'Peace/Friendship/Good',
    9: 'Warning/Attention/Important',
  } as const;
  // Keep legacy descriptions for compatibility; other sets intentionally generic
  return (descriptions as Record<number, string>)[value] ?? 'Unknown';
}

/**
 * Builds a reverse lookup map (emoji -> digit) for a given set.
 */
export function getEmojiToNumberMap(set: EmojiSet): Record<string, number> {
  const entries = SPACE_EMOJIS[set].map((emoji, index) => [emoji, index as number]);
  return Object.fromEntries(entries);
}

// Backward-compatible default reverse map
export const emojiToNumber = getEmojiToNumberMap(DEFAULT_EMOJI_SET);
