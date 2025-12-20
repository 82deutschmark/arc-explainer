/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-19
 * PURPOSE: Discover and aggregate allowed SnakeBench models from curated config and live database.
 *          Builds allowlist from MODELS config + optionally DB-discovered OpenRouter models.
 * SRP/DRY check: Pass — model discovery logic isolated, single source for model allowlist.
 */

import { MODELS } from '../../../config/models.ts';
import { repositoryService } from '../../../repositories/RepositoryService.ts';
import { logger } from '../../../utils/logger.ts';

/**
 * Get all SnakeBench-allowed models.
 *
 * Includes:
 * 1. Curated OpenRouter models from central MODELS config (always)
 * 2. DB-discovered OpenRouter models marked as active (optional, keeps Worm Arena aligned with catalog)
 *
 * Returns sorted alphabetically.
 */
export async function getSnakeBenchAllowedModels(): Promise<string[]> {
  const allowed = new Set<string>();

  // Always include curated OpenRouter models from the central config.
  MODELS.filter((m) => m.provider === 'OpenRouter').forEach((m) => {
    const raw = m.apiModelName || m.key;
    if (typeof raw !== 'string') return;
    const trimmed = raw.trim();
    if (!trimmed) return;
    allowed.add(trimmed);
  });

  // Optionally include DB-discovered OpenRouter models marked active.
  // This keeps Worm Arena aligned with the continually-updating OpenRouter catalog.
  if (repositoryService.isInitialized()) {
    try {
      const dbModels = await repositoryService.snakeBench.listModels();
      dbModels
        .filter((m) => (m.provider || '').toLowerCase() === 'openrouter' && (m as any).is_active)
        .forEach((m) => {
          const slug = String((m as any).model_slug ?? '').trim();
          if (!slug) return;
          allowed.add(slug);
        });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(
        `getSnakeBenchAllowedModels: failed to load DB models: ${msg}`,
        'snakebench-service'
      );
    }
  }

  return Array.from(allowed).sort((a, b) => a.localeCompare(b));
}
