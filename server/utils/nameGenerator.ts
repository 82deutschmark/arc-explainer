/**
 * nameGenerator.ts
 *
 * Author: Claude Opus 4.5
 * Date: 2025-12-30
 * PURPOSE: Generate fun, memorable solver names for anonymous RE-ARC submissions.
 *          Format: "Adjective Animal" (e.g., "Brave Pangolin", "Cosmic Axolotl")
 * SRP/DRY check: Pass - Single responsibility for name generation
 */

const ADJECTIVES = [
  'Brave', 'Swift', 'Clever', 'Noble', 'Cosmic', 'Quantum',
  'Stellar', 'Bold', 'Wise', 'Nimble', 'Radiant', 'Mystic',
  'Ancient', 'Fierce', 'Gentle', 'Silent', 'Bright', 'Calm',
  'Daring', 'Eager', 'Golden', 'Hidden', 'Jolly', 'Keen',
  'Lucky', 'Mighty', 'Patient', 'Quick', 'Royal', 'Sage',
  'Steady', 'Tiny', 'Vivid', 'Wild', 'Young', 'Zen',
  'Crystal', 'Electric', 'Frozen', 'Glowing', 'Harmonic', 'Infinite',
];

const ANIMALS = [
  'Pangolin', 'Axolotl', 'Narwhal', 'Quokka', 'Capybara',
  'Octopus', 'Phoenix', 'Griffin', 'Mantis', 'Falcon',
  'Dolphin', 'Otter', 'Badger', 'Raven', 'Lynx',
  'Crane', 'Fox', 'Owl', 'Wolf', 'Bear',
  'Hawk', 'Heron', 'Ibis', 'Jaguar', 'Koala',
  'Lemur', 'Mongoose', 'Newt', 'Ocelot', 'Panda',
  'Quail', 'Rabbit', 'Salamander', 'Tapir', 'Uakari',
  'Viper', 'Wombat', 'Xerus', 'Yak', 'Zebra',
];

/**
 * Generate a random solver name in the format "Adjective Animal".
 * @returns A fun, memorable name like "Brave Pangolin"
 */
export function generateSolverName(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adjective} ${animal}`;
}

/**
 * Validate and sanitize a user-provided solver name.
 * - Trims whitespace
 * - Limits length to 255 characters
 * - Returns generated name if input is empty
 * @param name User-provided name (may be empty)
 * @returns Sanitized name or generated fallback
 */
export function sanitizeSolverName(name: string | undefined | null): string {
  if (!name || typeof name !== 'string') {
    return generateSolverName();
  }

  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return generateSolverName();
  }

  // Limit to 255 characters (database column limit)
  return trimmed.slice(0, 255);
}
