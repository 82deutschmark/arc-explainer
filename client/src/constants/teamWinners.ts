/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-06
 * PURPOSE: Configuration mapping for 2025 ARC Prize team winners and their member contributors.
 * Defines which individual contributors belong to which team, keyed by teamName for stable lookups.
 * Used by HumanTradingCards.tsx to group team winners with their members in a special layout.
 * SRP/DRY check: Pass - Single responsibility for team grouping configuration, reusable mapping.
 */

/**
 * Maps teamName to an array of member contributor fullNames.
 * Keys must match the teamName field in the seed data.
 * Member fullNames must exactly match contributor.fullName for successful lookup.
 * Note: If a member is missing from the seed data, it will be skipped with a console warning.
 */
export const teamWinnersConfig = {
  NVARC: [
    'Jean-François Puget (2024 Paper)'
    // Ivan Sorokin missing as individual entry - would be added here
  ],
  ARChitects: [
    // Individual entries not available in seed data yet
    // Daniel Franzen, Jan Disselhoff, David Hartmann members would go here
  ],
  MindsAI: [
    'Jack Cole (2024)',
    'Dries Smit'
  ]
} as const;

export type TeamName = keyof typeof teamWinnersConfig;
