/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-01
 * PURPOSE: Admin controller for administrative operations including data recovery
 *          and HuggingFace dataset ingestion management. Provides endpoints for:
 *          - Manual data recovery
 *          - Ingestion validation and execution
 *          - Admin dashboard statistics
 *          - Ingestion history tracking
 * SRP/DRY check: Pass - Single responsibility (admin operations), reuses existing services
 * shadcn/ui: N/A - Backend controller
 */

import { Router, Request, Response } from 'express';
import { recoveryService } from '../services/recoveryService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { repositoryService } from '../repositories/RepositoryService.js';
import { PuzzleLoader } from '../services/puzzleLoader.js';
import { validateSolverResponse, validateSolverResponseMulti } from '../services/responseValidator.js';
import { MODELS } from '../config/models.js';

const router = Router();
const puzzleLoader = new PuzzleLoader();

// ============================================================================
// DATA RECOVERY ENDPOINT (Existing)
// ============================================================================

/**
 * @route   POST /api/admin/start-recovery
 * @desc    Manually starts the data recovery process.
 * @access  Private (to be implemented)
 */
router.post('/start-recovery', asyncHandler(async (req: Request, res: Response) => {
  console.log('[API] Manual data recovery process initiated.');

  // Start the recovery process but do not wait for it to complete.
  // This allows the API to respond immediately.
  recoveryService.processRecovery(true); // Always run in non-interactive mode.

  res.status(202).json({
    success: true,
    message: 'Data recovery process has been initiated. Check server logs for progress.'
  });
}));

// ============================================================================
// ADMIN DASHBOARD ENDPOINTS (New)
// ============================================================================

/**
 * @route   GET /api/admin/quick-stats
 * @desc    Get dashboard statistics for admin hub
 * @access  Private
 */
export async function getQuickStats(req: Request, res: Response) {
  try {
    const dbConnected = repositoryService.isInitialized();

    // Get total models
    const totalModels = MODELS.length;

    // Get total explanations and last ingestion
    let totalExplanations = 0;
    let lastIngestion = null;

    if (dbConnected) {
      // Count all explanations using repository method
      totalExplanations = await repositoryService.explanations.countExplanations();

      // Get last ingestion run from ingestion_runs table
      try {
        const historyResult = await repositoryService.db?.query(
          `SELECT started_at FROM ingestion_runs ORDER BY started_at DESC LIMIT 1`
        );

        if (historyResult && historyResult.rows.length > 0) {
          lastIngestion = historyResult.rows[0].started_at;
        }
      } catch (error) {
        // Table might not exist yet, ignore
        console.log('[Admin] ingestion_runs table not found (migration not run yet)');
      }
    }

    res.json({
      totalModels,
      totalExplanations,
      databaseConnected: dbConnected,
      lastIngestion,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Error getting quick stats:', error);
    res.status(500).json({
      error: 'Failed to get quick stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * @route   GET /api/admin/recent-activity
 * @desc    Get recent administrative activity (last 10 ingestion runs)
 * @access  Private
 */
export async function getRecentActivity(req: Request, res: Response) {
  try {
    if (!repositoryService.isInitialized()) {
      return res.json({ runs: [] });
    }

    try {
      const result = await repositoryService.db?.query(`
        SELECT
          id,
          dataset_name,
          source,
          total_puzzles,
          successful,
          failed,
          skipped,
          dry_run,
          started_at,
          completed_at,
          accuracy_percent
        FROM ingestion_runs
        ORDER BY started_at DESC
        LIMIT 10
      `);

      const runs = result?.rows || [];

      res.json({
        runs: runs.map((run: any) => ({
          id: run.id,
          datasetName: run.dataset_name,
          source: run.source,
          totalPuzzles: run.total_puzzles,
          successful: run.successful,
          failed: run.failed,
          skipped: run.skipped,
          dryRun: run.dry_run,
          startedAt: run.started_at,
          completedAt: run.completed_at,
          accuracyPercent: run.accuracy_percent ? parseFloat(run.accuracy_percent) : null,
          duration: new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()
        }))
      });
    } catch (error) {
      // Table might not exist yet
      console.log('[Admin] ingestion_runs table not found');
      res.json({ runs: [] });
    }
  } catch (error) {
    console.error('[Admin] Error getting recent activity:', error);
    res.status(500).json({
      error: 'Failed to get recent activity',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// ============================================================================
// HUGGINGFACE INGESTION ENDPOINTS (New)
// ============================================================================

/**
 * Auto-detect ARC source from HuggingFace dataset URL
 */
function autoDetectSource(baseUrl: string): string | null {
  const url = baseUrl.toLowerCase();

  if (url.includes('arc_agi_v1') && url.includes('eval')) {
    return 'ARC1-Eval';
  }
  if (url.includes('arc_agi_v1') && url.includes('train')) {
    return 'ARC1';
  }
  if (url.includes('arc_agi_v2') && url.includes('eval')) {
    return 'ARC2-Eval';
  }
  if (url.includes('arc_agi_v2') && url.includes('train')) {
    return 'ARC2';
  }

  return null;
}

/**
 * @route   POST /api/admin/validate-ingestion
 * @desc    Validate ingestion configuration before running
 * @access  Private
 */
export async function validateIngestion(req: Request, res: Response) {
  try {
    const { datasetName, baseUrl } = req.body;

    const checks: any = {
      urlAccessible: false,
      tokenPresent: !!process.env.HF_TOKEN,
      databaseConnected: repositoryService.isInitialized(),
      sourceDetected: null,
      puzzleCount: 0,
      samplePuzzle: null
    };

    const errors: string[] = [];

    // Auto-detect source
    checks.sourceDetected = autoDetectSource(baseUrl);

    // Check URL accessibility with sample puzzle
    try {
      const samplePuzzleId = '00576224'; // Known puzzle ID
      const testUrl = `${baseUrl}/${datasetName}/${samplePuzzleId}.json`;

      const response = await fetch(testUrl, {
        headers: baseUrl.includes('huggingface.co') && process.env.HF_TOKEN
          ? { 'Authorization': `Bearer ${process.env.HF_TOKEN}` }
          : {}
      });

      if (response.ok) {
        checks.urlAccessible = true;
        const sampleData = await response.json();
        checks.samplePuzzle = {
          id: samplePuzzleId,
          hasData: Array.isArray(sampleData) && sampleData.length > 0,
          testCases: Array.isArray(sampleData) ? sampleData.length : 0
        };
      } else if (response.status === 401) {
        errors.push('401 Unauthorized - Check HF_TOKEN environment variable');
      } else if (response.status === 404) {
        errors.push('404 Not Found - Verify dataset name and base URL');
      } else {
        errors.push(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error: any) {
      errors.push(`URL check failed: ${error.message}`);
    }

    // Check database
    if (!checks.databaseConnected) {
      errors.push('Database not available - Check DATABASE_URL');
    }

    // Get puzzle count from detected source
    if (checks.sourceDetected) {
      const puzzleList = puzzleLoader.getPuzzleList({ source: checks.sourceDetected as any });
      checks.puzzleCount = puzzleList.length;
    } else {
      const allPuzzles = puzzleLoader.getPuzzleList();
      checks.puzzleCount = allPuzzles.length;
    }

    // Check if sample puzzle exists in database (for existing entries check)
    if (checks.samplePuzzle && checks.databaseConnected) {
      const existingExplanations = await repositoryService.explanations.getExplanationsForPuzzle(
        checks.samplePuzzle.id
      );
      (checks.samplePuzzle as any).existingEntries = existingExplanations.length;
    }

    res.json({
      valid: errors.length === 0,
      checks,
      errors
    });
  } catch (error) {
    console.error('[Admin] Error validating ingestion:', error);
    res.status(500).json({
      error: 'Validation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * @route   GET /api/admin/ingestion-history
 * @desc    Get history of past ingestion runs
 * @access  Private
 */
export async function getIngestionHistory(req: Request, res: Response) {
  try {
    if (!repositoryService.isInitialized()) {
      return res.json({ runs: [] });
    }

    try {
      const result = await repositoryService.db?.query(`
        SELECT
          id,
          dataset_name,
          base_url,
          source,
          total_puzzles,
          successful,
          failed,
          skipped,
          duration_ms,
          dry_run,
          accuracy_percent,
          started_at,
          completed_at,
          error_log
        FROM ingestion_runs
        ORDER BY started_at DESC
      `);

      const runs = result?.rows || [];

      res.json({
        runs: runs.map((run: any) => ({
          id: run.id,
          datasetName: run.dataset_name,
          baseUrl: run.base_url,
          source: run.source,
          totalPuzzles: run.total_puzzles,
          successful: run.successful,
          failed: run.failed,
          skipped: run.skipped,
          durationMs: run.duration_ms,
          dryRun: run.dry_run,
          accuracyPercent: run.accuracy_percent ? parseFloat(run.accuracy_percent) : null,
          startedAt: run.started_at,
          completedAt: run.completed_at,
          errorLog: run.error_log
        }))
      });
    } catch (error) {
      // Table might not exist yet
      console.log('[Admin] ingestion_runs table not found');
      res.json({ runs: [] });
    }
  } catch (error) {
    console.error('[Admin] Error getting ingestion history:', error);
    res.status(500).json({
      error: 'Failed to get ingestion history',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Export router as default
export default router;
