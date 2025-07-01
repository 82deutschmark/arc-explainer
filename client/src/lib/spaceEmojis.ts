// Space emoji mapping for ARC-AGI puzzles
// The aliens only communicate with us using these specific emojis
export const spaceEmojis = {
  0: '⬛', // no/nothing/negative
  1: '✅', // yes/positive/agreement
  2: '👽', // alien/them
  3: '👤', // human/us
  4: '🪐', // their planet/home
  5: '🌍', // our planet/Earth
  6: '🛸', // their ships/travel
  7: '☄️', // danger/bad/problem
  8: '♥️', // peace/friendship/good
  9: '⚠️', // warning/attention/important
} as const;

export type SpaceEmojiValue = keyof typeof spaceEmojis;

export function getSpaceEmoji(value: number): string {
  return spaceEmojis[value as SpaceEmojiValue] || '❓';
}

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
  return descriptions[value as SpaceEmojiValue] || 'Unknown';
}

export const emojiToNumber = Object.fromEntries(
  Object.entries(spaceEmojis).map(([num, emoji]) => [emoji, parseInt(num)])
);
