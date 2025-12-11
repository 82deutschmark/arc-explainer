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
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/models';

type OpenRouterModel = {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
};

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

// Helper: normalize HF base url to use resolve/main for raw JSON
function normalizeHfBaseUrl(url: string): string {
  try {
    let u = (url || '').trim();
    return u.replace(/\/tree\//, '/resolve/').replace(/\/$/, '');
  } catch {
    return url;
  }
}

// Helper: extract dataset path parts from a HF URL (namespace/repo)
function parseHfDatasetPath(url: string): { namespace: string; repo: string } | null {
  try {
    const m = url.match(/huggingface\.co\/datasets\/([^\/]+)\/([^\/?#]+)/i);
    if (!m) return null;
    return { namespace: m[1], repo: m[2] };
  } catch {
    return null;
  }
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

    // Auto-detect source (works with either tree or resolve form)
    const normalizedBase = normalizeHfBaseUrl(baseUrl);
    checks.sourceDetected = autoDetectSource(normalizedBase);

    // Skip URL check - we know the exact URLs for ARC1-Eval and ARC2-Eval
    checks.urlAccessible = true;

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
 * @route   POST /api/admin/start-ingestion
 * @desc    Start HuggingFace dataset ingestion
 * @access  Private
 */
export async function startIngestion(req: Request, res: Response) {
  try {
    const { datasetName, baseUrl, source, limit, delay, dryRun, forceOverwrite, verbose } = req.body;

    if (!datasetName || !baseUrl) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'datasetName and baseUrl are required'
      });
    }

    // Import the ingestion function dynamically
    const { ingestHuggingFaceDataset } = await import('../scripts/ingest-huggingface-dataset.js');

    // Start ingestion asynchronously
    ingestHuggingFaceDataset({
      datasetName,
      baseUrl,
      source: source === 'auto' ? autoDetectSource(baseUrl) : source,
      limit: limit || undefined,
      delay: delay || 100,
      dryRun: !!dryRun,
      forceOverwrite: !!forceOverwrite,
      verbose: !!verbose,
      skipDuplicates: !forceOverwrite, // Skip duplicates unless force overwrite is enabled
      stopOnError: false // Continue processing even on errors
    }).catch((error: Error) => {
      console.error('[Admin] Ingestion error:', error);
    });

    res.status(202).json({
      success: true,
      message: 'Ingestion started. Check server logs for progress.',
      config: {
        datasetName,
        baseUrl,
        source: source === 'auto' ? autoDetectSource(baseUrl) : source,
        dryRun
      }
    });
  } catch (error) {
    console.error('[Admin] Error starting ingestion:', error);
    res.status(500).json({
      error: 'Failed to start ingestion',
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

/**
 * @route   GET /api/admin/hf-folders
 * @desc    List top-level folders in a HuggingFace dataset repo and mark which are already ingested
 * @query   baseUrl: string (e.g., https://huggingface.co/datasets/arcprize/arc_agi_v1_public_eval/tree/main or resolve/main)
 */
export async function listHFFolders(req: Request, res: Response) {
  try {
    const baseUrl = String(req.query.baseUrl || '');
    if (!baseUrl) {
      return res.status(400).json({ error: 'Missing baseUrl query param' });
    }

    const parsed = parseHfDatasetPath(baseUrl);
    if (!parsed) {
      return res.status(400).json({ error: 'Invalid Hugging Face dataset URL' });
    }

    // HF API: list tree for datasets
    // Example: https://huggingface.co/api/datasets/arcprize/arc_agi_v1_public_eval/tree/main?path=
    const apiUrl = `https://huggingface.co/api/datasets/${parsed.namespace}/${parsed.repo}/tree/main?path=`;

    const resp = await fetch(apiUrl, {
      headers: process.env.HF_TOKEN ? { 'Authorization': `Bearer ${process.env.HF_TOKEN}` } : {}
    });

    if (!resp.ok) {
      const info = await resp.text().catch(() => resp.statusText);
      return res.status(resp.status).json({ error: `HF API error: ${info}` });
    }

    const items = await resp.json();
    // Expect array of entries with {type, path}
    const folders: string[] = Array.isArray(items)
      ? items.filter((it: any) => it.type === 'directory').map((it: any) => it.path.split('/').pop())
      : [];

    // For each folder, check DB if any entries exist matching `${folder}-attempt%`
    const results: Array<{ name: string; ingested: boolean; attemptsFound: number }> = [];

    if (!repositoryService.isInitialized() || folders.length === 0) {
      for (const f of folders) results.push({ name: f, ingested: false, attemptsFound: 0 });
      return res.json({ folders: results });
    }

    // Detect source from the base URL to filter puzzles correctly
    const detectedSource = autoDetectSource(baseUrl);

    for (const f of folders) {
      try {
        if (!detectedSource) {
          // No source detected, fall back to simple name check
          const q = `SELECT COUNT(*)::int AS c FROM explanations WHERE model_name ILIKE $1`;
          const like = `${f}-attempt%`;
          const r = await repositoryService.db!.query(q, [like]);
          const count = r.rows?.[0]?.c || 0;
          results.push({ name: f, ingested: count > 0, attemptsFound: count });
        } else {
          // Check if this model has entries for puzzles from THIS source
          // Load puzzle IDs just once per folder to pass as array parameter
          const puzzleList = puzzleLoader.getPuzzleList({ source: detectedSource as any });
          const sourcePuzzleIds = puzzleList.map(p => p.id);
          
          const q = `
            SELECT COUNT(*)::int AS c 
            FROM explanations e
            WHERE e.model_name ILIKE $1
            AND e.puzzle_id = ANY($2::text[])
          `;
          const like = `${f}-attempt%`;
          const r = await repositoryService.db!.query(q, [like, sourcePuzzleIds]);
          const count = r.rows?.[0]?.c || 0;
          results.push({ name: f, ingested: count > 0, attemptsFound: count });
        }
      } catch (e) {
        results.push({ name: f, ingested: false, attemptsFound: 0 });
      }
    }

    res.json({ folders: results });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list HF folders', message: error instanceof Error ? error.message : String(error) });
  }
}

// ============================================================================
// OPENROUTER DISCOVERY / IMPORT ENDPOINTS (New)
// ============================================================================

async function fetchOpenRouterCatalog(): Promise<OpenRouterModel[]> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (process.env.OPENROUTER_API_KEY) {
    headers.Authorization = `Bearer ${process.env.OPENROUTER_API_KEY}`;
  }

  const resp = await fetch(OPENROUTER_ENDPOINT, { headers });
  if (!resp.ok) {
    const info = await resp.text().catch(() => resp.statusText);
    throw new Error(`OpenRouter API error: ${resp.status} ${info}`);
  }
  const payload = (await resp.json()) as { data?: OpenRouterModel[] };
  return payload.data ?? [];
}

function flagPreview(slug: string): boolean {
  const lower = slug.toLowerCase();
  return (
    lower.includes('preview') ||
    lower.includes('beta') ||
    lower.includes(':free') ||
    lower.includes(':exacto') ||
    lower.includes('sandbox') ||
    lower.includes('dev')
  );
}

/**
 * @route   GET /api/admin/openrouter/discover
 * @desc    Fetch OpenRouter catalog and list slugs not present in DB/config
 * @access  Private
 */
export async function discoverOpenRouter(req: Request, res: Response) {
  try {
    const remote = await fetchOpenRouterCatalog();

    const configSlugs = new Set(
      MODELS.filter((m) => m.modelType === 'openrouter')
        .map((m) => m.apiModelName || m.key)
        .filter(Boolean) as string[]
    );

    const dbModels = repositoryService.isInitialized() ? await repositoryService.snakeBench.listModels() : [];
    const dbSlugs = new Set(dbModels.map((m) => m.model_slug));

    const newModels = remote
      .filter((m) => m.id && !configSlugs.has(m.id) && !dbSlugs.has(m.id))
      .map((m) => ({
        id: m.id,
        name: m.name ?? m.id,
        contextLength: m.context_length ?? null,
        isPreview: flagPreview(m.id),
      }));

    res.json({
      totalRemote: remote.length,
      totalLocalConfig: configSlugs.size,
      totalLocalDb: dbSlugs.size,
      newModels,
    });
  } catch (error) {
    console.error('[Admin] OpenRouter discovery failed:', error);
    res.status(500).json({
      error: 'Failed to fetch OpenRouter catalog',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * @route   POST /api/admin/openrouter/import
 * @desc    Import selected OpenRouter slugs into DB (models table)
 * @body    { slugs: string[], nameOverrides?: Record<string,string> }
 * @access  Private
 */
export async function importOpenRouter(req: Request, res: Response) {
  try {
    const { slugs, nameOverrides } = req.body as { slugs?: string[]; nameOverrides?: Record<string, string> };
    if (!Array.isArray(slugs) || slugs.length === 0) {
      return res.status(400).json({ error: 'No slugs provided' });
    }

    if (!repositoryService.isInitialized()) {
      return res.status(500).json({ error: 'Database not available for import' });
    }

    const models = slugs.map((slug) => ({
      modelSlug: slug,
      name: nameOverrides?.[slug] || slug,
      provider: 'OpenRouter',
      isActive: true,
      testStatus: 'untested',
    }));

    const result = await repositoryService.snakeBench.upsertModels(models);

    res.json({
      inserted: result.inserted,
      updated: result.updated,
      totalRequested: slugs.length,
    });
  } catch (error) {
    console.error('[Admin] OpenRouter import failed:', error);
    res.status(500).json({
      error: 'Failed to import models',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Export router as default
export default router;
