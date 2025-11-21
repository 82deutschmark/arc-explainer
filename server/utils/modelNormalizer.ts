/**
 * Model Name Normalizer
 * 
 * Provides utility functions to normalize model names for consistent analytics.
 * Handles common model name variations without requiring database changes.
 * 
 * @author Claude
 * @date 2025-09-12
 */

/**
 * Normalize a model name to its base form for analytics consistency
 *
 * Common normalizations:
 * - Remove :free suffixes (z-ai/glm-4.5-air:free → z-ai/glm-4.5-air)
 * - Remove :beta, :alpha, -beta, -alpha suffixes
 * - Handle version variations
 *
 * @param modelName - The original model name from the database
 * @returns Normalized model name for analytics grouping
 */
export function normalizeModelName(modelName: string): string {
  if (!modelName || typeof modelName !== 'string') {
    return modelName;
  }

  let normalized = modelName.trim();

  // Preserve attempt-level variants. Temporarily strip the suffix so we can
  // normalize the base model identifier, then restore it afterwards.
  const attemptSuffixMatch = normalized.match(/-attempt\d+$/i);
  const attemptSuffix = attemptSuffixMatch ? attemptSuffixMatch[0] : '';
  if (attemptSuffix) {
    normalized = normalized.slice(0, -attemptSuffix.length);
  }

  // Remove common suffixes that don't affect the core model identity
  // Handle both colon-style (:free) and hyphen-style (-alpha) suffixes
  normalized = normalized.replace(/:free$/i, '');
  normalized = normalized.replace(/:beta$/i, '');
  normalized = normalized.replace(/:alpha$/i, '');
  normalized = normalized.replace(/-beta$/i, '');
  normalized = normalized.replace(/-alpha$/i, '');

  // Handle specific model name aliases and variants

  // GLM case: z-ai/glm-4.5-air:free → z-ai/glm-4.5
  // This maps the air variant to the base GLM 4.5 model
  if (normalized.startsWith('z-ai/glm-4.5-air')) {
    normalized = 'z-ai/glm-4.5';
  }

  // Sonoma-sky was actually grok-4-fast under a different name
  if (normalized === 'openrouter/sonoma-sky' || normalized.startsWith('openrouter/sonoma-sky')) {
    normalized = 'x-ai/grok-4-fast';
  }

  // Polaris Alpha was revealed to be GPT-5.1 on Nov 13, 2025
  if (normalized === 'openrouter/polaris-alpha' || normalized.startsWith('openrouter/polaris-alpha')) {
    normalized = 'openai/gpt-5.1';
  }

  // Sherlock Think Alpha was revealed to be Grok 4.1 Fast Reasoning on Nov 20, 2025
  if (normalized === 'openrouter/sherlock-think-alpha' || normalized.startsWith('openrouter/sherlock-think-alpha')) {
    normalized = 'x-ai/grok-4.1-fast';
  }

  return attemptSuffix ? `${normalized}${attemptSuffix}` : normalized;
}

/**
 * Normalize an array of model names, removing duplicates
 * 
 * @param modelNames - Array of original model names
 * @returns Array of unique normalized model names
 */
export function normalizeModelNames(modelNames: string[]): string[] {
  const normalizedSet = new Set(modelNames.map(normalizeModelName));
  return Array.from(normalizedSet);
}

/**
 * Check if two model names are equivalent after normalization
 * 
 * @param modelA - First model name
 * @param modelB - Second model name  
 * @returns True if the models are the same after normalization
 */
export function areModelsEquivalent(modelA: string, modelB: string): boolean {
  return normalizeModelName(modelA) === normalizeModelName(modelB);
}