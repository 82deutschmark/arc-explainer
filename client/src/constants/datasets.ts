/**
 * Author: Cascade
 * Date: 2025-12-17
 * PURPOSE: Centralized dataset display-name helpers to prevent duplicated mapping tables across pages.
 *          Supports both the ARC-style labels (ARC1-Eval, ARC2-Train, etc.) and the simpler "plain" labels
 *          that some components use.
 * SRP/DRY check: Pass - Dedicated to dataset naming only.
 */

export type DatasetDisplayStyle = 'arc' | 'plain';

/**
 * ARC-style dataset labels (used by analytics pages).
 */
export const DATASET_DISPLAY_NAME_MAP: Record<string, string> = {
  evaluation: 'ARC1-Eval',
  training: 'ARC1-Train',
  evaluation2: 'ARC2-Eval',
  training2: 'ARC2-Train',
  'arc-heavy': 'ARC-Heavy',
  'concept-arc': 'ConceptARC',
};

/**
 * Plain dataset labels (used where shorter, friendlier names are preferred).
 */
export const DATASET_PLAIN_DISPLAY_NAME_MAP: Record<string, string> = {
  training: 'Training',
  training2: 'Training 2',
  evaluation: 'Evaluation',
  evaluation2: 'Evaluation 2',
  'arc-heavy': 'ARC-Heavy',
  'concept-arc': 'Concept-ARC',
  explained: 'Explained',
};

/**
 * Returns the preferred display name for a dataset.
 */
export const getDatasetDisplayName = (name: string, style: DatasetDisplayStyle = 'arc'): string => {
  if (style === 'plain') {
    return DATASET_PLAIN_DISPLAY_NAME_MAP[name] ?? name;
  }
  return DATASET_DISPLAY_NAME_MAP[name] ?? name;
};
