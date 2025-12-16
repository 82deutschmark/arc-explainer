/**
 * Author: Cascade
 * Date: 2025-12-16T00:00:00Z
 * PURPOSE: Public API controller for harness-aligned accuracy stats.
 *          Exposes ARC-AGI harness-style scoring (average of per-puzzle scores) for two-attempt submissions
 *          stored as {baseModelName}-attempt1 / {baseModelName}-attempt2.
 * SRP/DRY check: Pass - Controller only validates inputs and delegates to AccuracyRepository.
 */

import type { Request, Response } from 'express';

import { repositoryService } from '../repositories/RepositoryService.ts';

export const getHarnessAlignedAccuracy = async (req: Request, res: Response) => {
  const baseModelName = req.query.baseModelName;
  const dataset = req.query.dataset;

  if (!baseModelName || typeof baseModelName !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'baseModelName required',
    });
  }

  const datasetName = typeof dataset === 'string' && dataset.trim() ? dataset : 'evaluation2';

  const stats = await repositoryService.accuracy.getHarnessAlignedAccuracyStats(
    baseModelName,
    datasetName,
  );

  return res.status(200).json({
    success: true,
    data: stats,
  });
};
