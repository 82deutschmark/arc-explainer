/**
 * Author: Cascade
 * Date: 2025-11-05
 * PURPOSE: Centralizes construction of Synapsomorphy ARC explorer links so UI components can link out consistently.
 * SRP/DRY check: Pass — provides a single helper for mapping puzzle sources to external dataset URLs.
 */

import type { ARCTask } from '@shared/types';

type ArcDataset = 'ARC-1-train' | 'ARC-1-test' | 'ARC-2-train' | 'ARC-2-test';

type SupportedSource = 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval';

const SOURCE_TO_DATASET: Record<SupportedSource, ArcDataset> = {
  'ARC1': 'ARC-1-train',
  'ARC1-Eval': 'ARC-1-test',
  'ARC2': 'ARC-2-train',
  'ARC2-Eval': 'ARC-2-test'
};

/**
 * Returns the Synapsomorphy ARC explorer URL for a given task if the dataset can be determined.
 *
 * @param taskId - ARC task identifier
 * @param source - Optional dataset source descriptor provided by PuzzleLoader
 * @returns Fully qualified Synapsomorphy URL or null when the dataset is unsupported
 */
export function getSynapsomorphyArcUrl(taskId: string, source?: ARCTask['source']): string | null {
  if (!taskId) {
    return null;
  }

  const dataset = source ? SOURCE_TO_DATASET[source as SupportedSource] : undefined;

  if (!dataset) {
    return null;
  }

  const url = new URL('https://synapsomorphy.com/arc/');
  url.searchParams.set('dataset', dataset);
  url.searchParams.set('task', taskId);
  return url.toString();
}
