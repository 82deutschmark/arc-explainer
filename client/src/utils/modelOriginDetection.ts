/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-12-16
 * PURPOSE: Centralized model origin detection utility to distinguish between HuggingFace official,
 * community solver submissions (Johan_Land), and ARC Explainer platform results.
 * Eliminates DRY violation of inline detection logic across multiple pages.
 * SRP/DRY check: Pass - Single responsibility (origin detection), reused across all comparison pages.
 */

export enum ModelOrigin {
  HF_OFFICIAL = 'hf_official',
  COMMUNITY_SOLVER = 'community_solver',
  ARC_EXPLAINER = 'arc_explainer',
}

export interface ModelOriginInfo {
  origin: ModelOrigin;
  label: string;
  description: string;
  shortLabel: string;
  badgeVariant: 'default' | 'secondary' | 'outline';
}

/**
 * Detects the origin of a model based on its naming pattern
 *
 * @param modelName - The model name from the database
 * @returns ModelOriginInfo with origin type and display properties
 *
 * @example
 * detectModelOrigin('gpt-5-2-2025-12-11-thinking-high-attempt1')
 * // Returns: { origin: 'hf_official', label: 'HuggingFace Official', ... }
 *
 * detectModelOrigin('Johan_Land_Solver_V6-attempt1')
 * // Returns: { origin: 'community_solver', label: 'Johan Land Community Solver', ... }
 *
 * detectModelOrigin('claude-sonnet-4')
 * // Returns: { origin: 'arc_explainer', label: 'ARC Explainer', ... }
 */
export function detectModelOrigin(modelName: string): ModelOriginInfo {
  const isAttemptPattern = modelName.endsWith('-attempt1') || modelName.endsWith('-attempt2');
  const isJohanLand = modelName.startsWith('Johan_Land');

  // Community solver submissions (Johan_Land)
  if (isJohanLand && isAttemptPattern) {
    return {
      origin: ModelOrigin.COMMUNITY_SOLVER,
      label: 'Johan Land Community Solver',
      description: 'Community-submitted solver results from Johan Land',
      shortLabel: 'Community',
      badgeVariant: 'secondary',
    };
  }

  // HuggingFace official evaluation results
  if (isAttemptPattern) {
    return {
      origin: ModelOrigin.HF_OFFICIAL,
      label: 'HuggingFace Official',
      description: 'Official ARC Prize team evaluation harness results',
      shortLabel: 'HF Official',
      badgeVariant: 'default',
    };
  }

  // ARC Explainer platform results
  return {
    origin: ModelOrigin.ARC_EXPLAINER,
    label: 'ARC Explainer',
    description: 'Results from ARC Explainer platform',
    shortLabel: 'Platform',
    badgeVariant: 'outline',
  };
}

/**
 * Groups models by their origin for organized display in selectors
 *
 * @param models - Array of model names
 * @returns Record of ModelOrigin to array of model names
 *
 * @example
 * groupModelsByOrigin(['gpt-5-attempt1', 'Johan_Land-attempt1', 'claude-sonnet-4'])
 * // Returns: {
 * //   hf_official: ['gpt-5-attempt1'],
 * //   community_solver: ['Johan_Land-attempt1'],
 * //   arc_explainer: ['claude-sonnet-4']
 * // }
 */
export function groupModelsByOrigin(models: string[]): Record<ModelOrigin, string[]> {
  const grouped: Record<ModelOrigin, string[]> = {
    [ModelOrigin.HF_OFFICIAL]: [],
    [ModelOrigin.COMMUNITY_SOLVER]: [],
    [ModelOrigin.ARC_EXPLAINER]: [],
  };

  models.forEach((modelName) => {
    const { origin } = detectModelOrigin(modelName);
    grouped[origin].push(modelName);
  });

  return grouped;
}
