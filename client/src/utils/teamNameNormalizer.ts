/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-06
 * PURPOSE: Normalize team names so variations (Tufa AI, MindsAI) map to canonical names.
 * Allows contributors with different team name variations to be grouped together.
 * SRP/DRY check: Pass - Single responsibility for team name normalization.
 */

/**
 * Map of team name variations to their canonical form.
 * Used when grouping contributors who work together under different name variations.
 */
const TEAM_NAME_ALIASES: Record<string, string> = {
  'Tufa AI': 'MindsAI',
  'Tufa Labs': 'MindsAI',
  'MindsAI': 'MindsAI',
};

/**
 * Normalize a team name to its canonical form.
 * Returns the canonical team name if found in aliases, otherwise returns the original name.
 */
export function normalizeTeamName(teamName: string | null | undefined): string | null {
  if (!teamName) return null;
  return TEAM_NAME_ALIASES[teamName] ?? teamName;
}
